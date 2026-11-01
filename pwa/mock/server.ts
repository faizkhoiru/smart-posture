import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import type {
  WsStateMessage,
  WsPoseMessage,
  WsAlertMessage,
  WebSocketMessage
} from '../src/types/ws';
import type {
  DeviceSummary,
  DeviceLatestState,
  SittingSession,
  PostureEvent,
  DeviceConfig
} from '../src/types/api';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

app.use(cors());
app.use(express.json());

const PORT = 8000;
const DEVICE_ID = 'spc-001';

export type ScenarioType =
  | 'sit_straight'
  | 'slouch_short'
  | 'slouch_long'
  | 'body_not_visible'
  | 'stand_up'
  | 'sensor_error'
  | 'backend_offline';

const AVAILABLE_SCENARIOS: ScenarioType[] = [
  'sit_straight',
  'slouch_short',
  'slouch_long',
  'body_not_visible',
  'stand_up',
  'sensor_error',
  'backend_offline'
];

// CLI Scenario Arg Parsing
const argScenarioIndex = process.argv.findIndex((arg) => arg === '--scenario' || arg === '-s');
let currentScenario: ScenarioType = 'sit_straight';
if (argScenarioIndex !== -1 && process.argv[argScenarioIndex + 1]) {
  const selected = process.argv[argScenarioIndex + 1] as ScenarioType;
  if (AVAILABLE_SCENARIOS.includes(selected)) {
    currentScenario = selected;
  }
}

// Current simulated state
let currentState: WsStateMessage = {
  type: 'state',
  chair: 'occupied',
  posture: 'good_posture',
  camera: 'on',
  device: 'online',
  analysis: 'ok',
  load: { kg: 62.4, is_estimate: true },
  muted_until: null,
  updated_at: new Date().toISOString()
};

let currentConfig: DeviceConfig = {
  occupied_threshold: 20.0,
  release_threshold: 10.0,
  debounce_ms: 2000,
  capture_interval_ms: 1000,
  min_visibility: 0.5,
  tolerance_seconds: 7,
  warning_min_frames: 5,
  remind_interval: 60,
  view_mode: 'side',
  camera_state: 'on'
};

const connectedClients = new Set<WebSocket>();

function broadcast(msg: WebSocketMessage) {
  const data = JSON.stringify(msg);
  for (const client of connectedClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// Pose Generator Helpers
function generateStraightPose(): WsPoseMessage {
  return {
    type: 'pose',
    timestamp: new Date().toISOString(),
    confidence: 0.94,
    keypoints: [
      { name: 'nose', x: 0.48, y: 0.15, visibility: 0.95 },
      { name: 'left_ear', x: 0.42, y: 0.18, visibility: 0.93 },
      { name: 'right_ear', x: 0.55, y: 0.18, visibility: 0.9 },
      { name: 'left_shoulder', x: 0.35, y: 0.4, visibility: 0.95 },
      { name: 'right_shoulder', x: 0.62, y: 0.4, visibility: 0.94 },
      { name: 'left_hip', x: 0.38, y: 0.75, visibility: 0.88 },
      { name: 'right_hip', x: 0.6, y: 0.75, visibility: 0.87 }
    ]
  };
}

function generateSlouchPose(): WsPoseMessage {
  // Posisi bahu membungkuk ke depan dan kepala condong
  return {
    type: 'pose',
    timestamp: new Date().toISOString(),
    confidence: 0.91,
    keypoints: [
      { name: 'nose', x: 0.58, y: 0.25, visibility: 0.94 },
      { name: 'left_ear', x: 0.52, y: 0.26, visibility: 0.92 },
      { name: 'right_ear', x: 0.63, y: 0.26, visibility: 0.89 },
      { name: 'left_shoulder', x: 0.42, y: 0.43, visibility: 0.93 },
      { name: 'right_shoulder', x: 0.68, y: 0.43, visibility: 0.92 },
      { name: 'left_hip', x: 0.38, y: 0.75, visibility: 0.88 },
      { name: 'right_hip', x: 0.6, y: 0.75, visibility: 0.87 }
    ]
  };
}

function generateHiddenPose(): WsPoseMessage {
  return {
    type: 'pose',
    timestamp: new Date().toISOString(),
    confidence: 0.15,
    keypoints: [
      { name: 'nose', x: 0.1, y: 0.1, visibility: 0.2 },
      { name: 'left_ear', x: 0.1, y: 0.1, visibility: 0.15 },
      { name: 'right_ear', x: 0.1, y: 0.1, visibility: 0.18 },
      { name: 'left_shoulder', x: 0.1, y: 0.2, visibility: 0.2 },
      { name: 'right_shoulder', x: 0.1, y: 0.2, visibility: 0.19 },
      { name: 'left_hip', x: 0.1, y: 0.3, visibility: 0.1 },
      { name: 'right_hip', x: 0.1, y: 0.3, visibility: 0.1 }
    ]
  };
}

// Scenario Runner Logic
let scenarioTimer: NodeJS.Timeout | null = null;
let scenarioStep = 0;

function applyScenario(scenario: ScenarioType) {
  currentScenario = scenario;
  scenarioStep = 0;
  console.log(`\n[Mock Server] Menjalankan Skenario: "${scenario}"`);

  if (scenarioTimer) {
    clearInterval(scenarioTimer);
    scenarioTimer = null;
  }

  switch (scenario) {
    case 'sit_straight':
      currentState = {
        type: 'state',
        chair: 'occupied',
        posture: 'good_posture',
        camera: 'on',
        device: 'online',
        analysis: 'ok',
        load: { kg: 63.2, is_estimate: true },
        muted_until: null,
        updated_at: new Date().toISOString()
      };
      broadcast(currentState);
      broadcast({ type: 'alert_clear', timestamp: new Date().toISOString() });

      scenarioTimer = setInterval(() => {
        broadcast(generateStraightPose());
      }, 1000);
      break;

    case 'slouch_short':
      // 3 detik membungkuk (warning), lalu kembali tegak (good_posture)
      currentState = {
        type: 'state',
        chair: 'occupied',
        posture: 'warning',
        camera: 'on',
        device: 'online',
        analysis: 'ok',
        load: { kg: 63.5, is_estimate: true },
        muted_until: null,
        updated_at: new Date().toISOString()
      };
      broadcast(currentState);

      scenarioTimer = setInterval(() => {
        scenarioStep++;
        if (scenarioStep <= 3) {
          broadcast(generateSlouchPose());
        } else {
          // Pulih
          currentState.posture = 'good_posture';
          currentState.updated_at = new Date().toISOString();
          broadcast(currentState);
          broadcast(generateStraightPose());
          broadcast({ type: 'alert_clear', timestamp: new Date().toISOString() });
        }
      }, 1000);
      break;

    case 'slouch_long':
      // Warning -> bad_posture + alert
      currentState = {
        type: 'state',
        chair: 'occupied',
        posture: 'warning',
        camera: 'on',
        device: 'online',
        analysis: 'ok',
        load: { kg: 64.0, is_estimate: true },
        muted_until: null,
        updated_at: new Date().toISOString()
      };
      broadcast(currentState);

      scenarioTimer = setInterval(() => {
        scenarioStep++;
        broadcast(generateSlouchPose());

        if (scenarioStep === 4) {
          currentState.posture = 'bad_posture';
          currentState.updated_at = new Date().toISOString();
          broadcast(currentState);

          const alertMsg: WsAlertMessage = {
            type: 'alert',
            event_id: Date.now(),
            level: 'bad_posture',
            message: 'Postur Anda mulai membungkuk. Silakan tegakkan tubuh secara perlahan agar lebih nyaman.',
            remind_interval_s: 60,
            timestamp: new Date().toISOString()
          };
          broadcast(alertMsg);
        }
      }, 1000);
      break;

    case 'body_not_visible':
      currentState = {
        type: 'state',
        chair: 'occupied',
        posture: 'pose_unavailable',
        camera: 'on',
        device: 'online',
        analysis: 'ok',
        load: { kg: 62.0, is_estimate: true },
        muted_until: null,
        updated_at: new Date().toISOString()
      };
      broadcast(currentState);
      scenarioTimer = setInterval(() => {
        broadcast(generateHiddenPose());
      }, 1000);
      break;

    case 'stand_up':
      currentState = {
        type: 'state',
        chair: 'empty',
        posture: null,
        camera: 'off',
        device: 'online',
        analysis: 'ok',
        load: { kg: 0.0, is_estimate: true },
        muted_until: null,
        updated_at: new Date().toISOString()
      };
      broadcast(currentState);
      broadcast({ type: 'alert_clear', timestamp: new Date().toISOString() });
      break;

    case 'sensor_error':
      currentState = {
        type: 'state',
        chair: 'empty',
        posture: null,
        camera: 'off',
        device: 'sensor_error',
        analysis: 'analysis_unavailable',
        load: { kg: null, is_estimate: false },
        muted_until: null,
        updated_at: new Date().toISOString()
      };
      broadcast(currentState);
      break;

    case 'backend_offline':
      currentState = {
        type: 'state',
        chair: 'empty',
        posture: null,
        camera: 'off',
        device: 'offline',
        analysis: 'analysis_unavailable',
        load: { kg: null, is_estimate: false },
        muted_until: null,
        updated_at: new Date().toISOString()
      };
      broadcast(currentState);
      // Tutup semua koneksi klien untuk mensimulasikan koneksi backend terputus
      for (const client of connectedClients) {
        client.close(1001, 'Backend Going Offline');
      }
      break;
  }
}

// REST Endpoints sesuai docs/API_CONTRACT.md Bagian 3
app.get('/api/devices', (_req, res) => {
  const devices: DeviceSummary[] = [
    {
      id: DEVICE_ID,
      name: 'Kursi Cerdas Utama (Lab IoT)',
      status: currentState.device,
      last_seen: new Date().toISOString()
    }
  ];
  res.json(devices);
});

app.get('/api/devices/:id/latest', (req, res) => {
  if (req.params.id !== DEVICE_ID) {
    return res.status(404).json({
      error: { code: 'device_not_found', message: 'Perangkat tidak ditemukan' }
    });
  }

  const latest: DeviceLatestState = {
    chair: currentState.chair,
    posture: currentState.posture,
    camera: currentState.camera,
    device: currentState.device,
    load: currentState.load,
    updated_at: currentState.updated_at
  };
  res.json(latest);
});

app.post('/api/devices/:id/calibrate/load', (req, res) => {
  const { step, known_weight_kg } = req.body;
  console.log(`[Kalibrasi Beban] Device: ${req.params.id}, Step: ${step}, Known Weight: ${known_weight_kg}`);
  res.json({
    ok: true,
    profile: {
      tare: 124500,
      scale: 448.5,
      calibrated_at: new Date().toISOString()
    }
  });
});

app.post('/api/devices/:id/calibrate/posture', (req, res) => {
  const { frames } = req.body;
  console.log(`[Kalibrasi Postur] Device: ${req.params.id}, Frames: ${frames || 10}`);
  res.json({
    ok: true,
    baseline: {
      side_angle: 93.4,
      head_offset: 0.04,
      shoulder_slope: 0.015,
      ear_shoulder_ratio: 0.44
    },
    warnings: []
  });
});

app.get('/api/devices/:id/sessions', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 5;
  const offset = parseInt(req.query.offset as string) || 0;

  const allSessions: SittingSession[] = [
    {
      id: 5,
      device_id: req.params.id,
      started_at: new Date(Date.now() - 3600000).toISOString(),
      ended_at: new Date(Date.now() - 600000).toISOString(),
      total_sit_s: 3000,
      good_s: 2700,
      bad_s: 300,
      alert_count: 1
    },
    {
      id: 4,
      device_id: req.params.id,
      started_at: new Date(Date.now() - 7200000).toISOString(),
      ended_at: new Date(Date.now() - 4800000).toISOString(),
      total_sit_s: 2400,
      good_s: 2000,
      bad_s: 400,
      alert_count: 2
    },
    {
      id: 3,
      device_id: req.params.id,
      started_at: new Date(Date.now() - 14400000).toISOString(),
      ended_at: new Date(Date.now() - 10800000).toISOString(),
      total_sit_s: 3600,
      good_s: 3300,
      bad_s: 300,
      alert_count: 1
    },
    {
      id: 2,
      device_id: req.params.id,
      started_at: new Date(Date.now() - 28800000).toISOString(),
      ended_at: new Date(Date.now() - 25200000).toISOString(),
      total_sit_s: 3600,
      good_s: 2900,
      bad_s: 700,
      alert_count: 3
    },
    {
      id: 1,
      device_id: req.params.id,
      started_at: new Date(Date.now() - 86400000).toISOString(),
      ended_at: new Date(Date.now() - 82800000).toISOString(),
      total_sit_s: 3600,
      good_s: 3400,
      bad_s: 200,
      alert_count: 1
    }
  ];

  const sliced = allSessions.slice(offset, offset + limit);
  res.json(sliced);
});

app.get('/api/devices/:id/events', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const offset = parseInt(req.query.offset as string) || 0;
  const statusFilter = req.query.status as string;

  const allEvents: PostureEvent[] = [
    {
      id: 105,
      device_id: req.params.id,
      timestamp: new Date(Date.now() - 120000).toISOString(),
      status: 'good_posture',
      confidence: 0.95,
      keypoints: generateStraightPose().keypoints,
      durasi: 60,
      acknowledged_at: null
    },
    {
      id: 104,
      device_id: req.params.id,
      timestamp: new Date(Date.now() - 300000).toISOString(),
      status: 'warning',
      confidence: 0.92,
      keypoints: generateSlouchPose().keypoints,
      durasi: 5,
      acknowledged_at: null
    },
    {
      id: 103,
      device_id: req.params.id,
      timestamp: new Date(Date.now() - 600000).toISOString(),
      status: 'bad_posture',
      confidence: 0.89,
      keypoints: generateSlouchPose().keypoints,
      durasi: 14,
      acknowledged_at: new Date(Date.now() - 580000).toISOString()
    },
    {
      id: 102,
      device_id: req.params.id,
      timestamp: new Date(Date.now() - 900000).toISOString(),
      status: 'pose_unavailable',
      confidence: 0.2,
      keypoints: generateHiddenPose().keypoints,
      durasi: 10,
      acknowledged_at: null
    },
    {
      id: 101,
      device_id: req.params.id,
      timestamp: new Date(Date.now() - 1500000).toISOString(),
      status: 'good_posture',
      confidence: 0.94,
      keypoints: generateStraightPose().keypoints,
      durasi: 120,
      acknowledged_at: null
    }
  ];

  let filtered = allEvents;
  if (statusFilter) {
    filtered = allEvents.filter((e) => e.status === statusFilter);
  }

  const sliced = filtered.slice(offset, offset + limit);
  res.json(sliced);
});

app.get('/api/devices/:id/config', (req, res) => {
  if (req.params.id !== DEVICE_ID) {
    return res.status(404).json({
      error: { code: 'device_not_found', message: 'Perangkat tidak ditemukan' }
    });
  }
  res.json(currentConfig);
});

app.put('/api/devices/:id/config', (req, res) => {
  currentConfig = { ...currentConfig, ...req.body };
  console.log(`[Config Updated]`, currentConfig);
  res.json({ ok: true, config: currentConfig });
});

app.post('/api/devices/:id/alerts/ack', (req, res) => {
  const { event_id } = req.body;
  console.log(`[Alert Acknowledged] event_id: ${event_id}`);
  res.json({ ok: true });
});

app.post('/api/devices/:id/alerts/mute', (req, res) => {
  const minutes = req.body.minutes || 5;
  const mutedUntil = new Date(Date.now() + minutes * 60000).toISOString();
  currentState.muted_until = mutedUntil;
  currentState.updated_at = new Date().toISOString();
  broadcast(currentState);
  console.log(`[Alert Muted] Sampai: ${mutedUntil}`);
  res.json({ muted_until: mutedUntil });
});

// Mock Controller Endpoints
app.get('/api/mock/scenario', (_req, res) => {
  res.json({
    current_scenario: currentScenario,
    available_scenarios: AVAILABLE_SCENARIOS
  });
});

app.post('/api/mock/scenario', (req, res) => {
  const { scenario } = req.body;
  if (!AVAILABLE_SCENARIOS.includes(scenario)) {
    return res.status(400).json({
      error: {
        code: 'invalid_scenario',
        message: `Skenario tidak dikenal. Pilihan: ${AVAILABLE_SCENARIOS.join(', ')}`
      }
    });
  }
  applyScenario(scenario);
  res.json({ ok: true, active_scenario: scenario });
});

// Upgrade HTTP ke WebSocket pada /ws/devices/:id
server.on('upgrade', (request, socket, head) => {
  const pathname = request.url || '';
  if (pathname.startsWith('/ws/devices/')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws, req) => {
  connectedClients.add(ws);
  console.log(`[WS] Client terhubung dari ${req.socket.remoteAddress}. Total klien: ${connectedClients.size}`);

  // Kirim status awal saat tersambung
  ws.send(JSON.stringify(currentState));

  ws.on('close', () => {
    connectedClients.delete(ws);
    console.log(`[WS] Client terputus. Sisa klien: ${connectedClients.size}`);
  });

  ws.on('error', (err) => {
    console.error('[WS Error]', err);
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  Smart Posture Corrector - Mock Server`);
  console.log(`  REST API : http://localhost:${PORT}/api`);
  console.log(`  WebSocket: ws://localhost:${PORT}/ws/devices/${DEVICE_ID}`);
  console.log(`  Scenario : ${currentScenario}`);
  console.log(`  Skenario Tersedia: ${AVAILABLE_SCENARIOS.join(', ')}`);
  console.log(`  Ganti skenario via POST http://localhost:${PORT}/api/mock/scenario`);
  console.log(`  Contoh: curl -X POST http://localhost:${PORT}/api/mock/scenario -H "Content-Type: application/json" -d "{\\"scenario\\":\\"slouch_long\\"}"`);
  console.log(`=======================================================`);

  // Mulai loop skenario
  applyScenario(currentScenario);
});
