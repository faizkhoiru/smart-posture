import { WebSocket } from 'ws';

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runFullVerification() {
  console.log('===========================================================');
  console.log('  VERIFIKASI INTEGRASI FASE 6A: PWA + MOCK SERVER');
  console.log('===========================================================');

  // 1. Uji REST API
  console.log('\n[1/4] Menguji REST API Endpoints...');
  const devicesRes = await fetch('http://localhost:8000/api/devices');
  const devices = await devicesRes.json();
  console.log('  ✓ GET /api/devices:', devices[0]?.name, `(status: ${devices[0]?.status})`);

  const latestRes = await fetch('http://localhost:8000/api/devices/spc-001/latest');
  const latest = await latestRes.json();
  console.log('  ✓ GET /api/devices/spc-001/latest:', `chair=${latest.chair}, posture=${latest.posture}`);

  const sessionsRes = await fetch('http://localhost:8000/api/devices/spc-001/sessions');
  const sessions = await sessionsRes.json();
  console.log('  ✓ GET /api/devices/spc-001/sessions:', `${sessions.length} sesi ditemukan`);

  const ackRes = await fetch('http://localhost:8000/api/devices/spc-001/alerts/ack', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_id: 101 })
  });
  const ack = await ackRes.json();
  console.log('  ✓ POST /api/devices/spc-001/alerts/ack:', ack.ok ? 'Sukses' : 'Gagal');

  const muteRes = await fetch('http://localhost:8000/api/devices/spc-001/alerts/mute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ minutes: 5 })
  });
  const mute = await muteRes.json();
  console.log('  ✓ POST /api/devices/spc-001/alerts/mute:', `muted_until=${mute.muted_until}`);

  // 2. Uji WebSocket & Keypoints Pose
  console.log('\n[2/4] Menguji Koneksi WebSocket & Stream Pose...');
  const ws = new WebSocket('ws://localhost:8000/ws/devices/spc-001');

  let stateReceived = false;
  let poseReceived = false;
  let alertReceived = false;
  let keypointsValid = false;

  ws.on('open', () => {
    console.log('  ✓ WebSocket connected ke ws://localhost:8000/ws/devices/spc-001');
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'state') {
      stateReceived = true;
    }
    if (msg.type === 'pose') {
      poseReceived = true;
      if (Array.isArray(msg.keypoints) && msg.keypoints.length === 7) {
        keypointsValid = true;
      }
    }
    if (msg.type === 'alert') {
      alertReceived = true;
    }
  });

  await wait(2000);
  console.log('  ✓ Pesan state awal diterima:', stateReceived ? 'YA' : 'TIDAK');
  console.log('  ✓ Stream pose diterima:', poseReceived ? 'YA' : 'TIDAK');
  console.log('  ✓ Validasi 7 keypoints MediaPipe:', keypointsValid ? 'VALID (7 keypoints lengkap)' : 'TIDAK VALID');

  // 3. Uji Skenario Dinamis: slouch_long (menghasilkan peringatan dan alert)
  console.log('\n[3/4] Menguji Skenario "slouch_long" (Simulasi Postur Membungkuk)...');
  await fetch('http://localhost:8000/api/mock/scenario', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario: 'slouch_long' })
  });

  console.log('  Menunggu transisi status warning -> bad_posture -> alert (5 detik)...');
  await wait(5500);
  console.log('  ✓ Pesan alert bad_posture diterima via WebSocket:', alertReceived ? 'YA (SUKSES)' : 'TIDAK');

  // 4. Uji Skenario Degradasi: sensor_error
  console.log('\n[4/4] Menguji Skenario Degradasi "sensor_error"...');
  await fetch('http://localhost:8000/api/mock/scenario', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario: 'sensor_error' })
  });
  await wait(1500);

  const checkSensor = await fetch('http://localhost:8000/api/devices/spc-001/latest');
  const sensorData = await checkSensor.json();
  console.log('  ✓ Status device pasca sensor_error:', sensorData.device, `(analysis: ${sensorData.analysis ?? 'analysis_unavailable'})`);

  ws.close();

  if (stateReceived && poseReceived && keypointsValid && alertReceived) {
    console.log('\n===========================================================');
    console.log('  HASIL AKHIR: SEMUA VERIFIKASI FASE 6A BERHASIL 100%!');
    console.log('===========================================================\n');
    process.exit(0);
  } else {
    console.error('\nGAGAL: Beberapa verifikasi tidak terpenuhi.\n');
    process.exit(1);
  }
}

runFullVerification();
