/**
 * Tipe pesan WebSocket sesuai API_CONTRACT.md Bagian 4.
 * Endpoint: WS /ws/devices/{device_id}
 */

export type ChairState = 'empty' | 'occupied' | 'calibrating';
export type PostureState = 'good_posture' | 'warning' | 'bad_posture' | 'pose_unavailable' | null;
export type CameraState = 'on' | 'off';
export type DeviceState = 'online' | 'offline' | 'sensor_error';
export type AnalysisState = 'ok' | 'analysis_unavailable';

export interface LoadInfo {
  kg: number | null;
  is_estimate: boolean;
}

export type KeypointName =
  | 'nose'
  | 'left_ear'
  | 'right_ear'
  | 'left_shoulder'
  | 'right_shoulder'
  | 'left_hip'
  | 'right_hip';

export interface Keypoint {
  name: KeypointName;
  x: number; // 0.0 - 1.0 (kiri-atas = 0,0)
  y: number; // 0.0 - 1.0
  visibility: number; // 0.0 - 1.0
}

export interface WsStateMessage {
  type: 'state';
  chair: ChairState;
  posture: PostureState;
  camera: CameraState;
  device: DeviceState;
  analysis: AnalysisState;
  load: LoadInfo;
  muted_until: string | null;
  updated_at: string; // ISO 8601 UTC
}

export interface WsPoseMessage {
  type: 'pose';
  timestamp: string; // ISO 8601 UTC
  confidence: number;
  keypoints: Keypoint[];
}

export interface WsAlertMessage {
  type: 'alert';
  event_id: number;
  level: 'bad_posture';
  message: string;
  remind_interval_s: number;
  timestamp: string; // ISO 8601 UTC
}

export interface WsAlertClearMessage {
  type: 'alert_clear';
  timestamp: string; // ISO 8601 UTC
}

export type WebSocketMessage =
  | WsStateMessage
  | WsPoseMessage
  | WsAlertMessage
  | WsAlertClearMessage;

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

