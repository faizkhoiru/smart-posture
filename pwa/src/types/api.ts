/**
 * Tipe REST API sesuai API_CONTRACT.md Bagian 3.
 */

import {
  ChairState,
  PostureState,
  CameraState,
  DeviceState,
  LoadInfo,
  Keypoint
} from './ws';

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export interface DeviceSummary {
  id: string;
  name: string;
  status: DeviceState;
  last_seen: string; // ISO 8601 UTC
}

export interface DeviceLatestState {
  chair: ChairState;
  posture: PostureState;
  camera: CameraState;
  device: DeviceState;
  load: LoadInfo;
  updated_at: string; // ISO 8601 UTC
}

export interface CalibrateLoadRequest {
  step: 'empty' | 'occupied';
  known_weight_kg?: number;
}

export interface CalibrateLoadResponse {
  ok: boolean;
  profile?: {
    tare?: number;
    scale?: number;
    calibrated_at?: string;
  };
}

export interface CalibratePostureRequest {
  frames?: number;
}

export interface CalibratePostureResponse {
  ok: boolean;
  baseline?: {
    side_angle?: number;
    head_offset?: number;
    shoulder_slope?: number;
    ear_shoulder_ratio?: number;
  };
  warnings?: string[];
}

export interface SittingSession {
  id: number;
  device_id: string;
  started_at: string;
  ended_at: string | null;
  total_sit_s: number;
  good_s: number;
  bad_s: number;
  alert_count: number;
}

export interface PostureEvent {
  id: number;
  device_id: string;
  timestamp: string;
  status: 'good_posture' | 'warning' | 'bad_posture' | 'pose_unavailable';
  confidence: number;
  keypoints: Keypoint[];
  durasi: number;
  acknowledged_at: string | null;
}

export interface DeviceConfig {
  occupied_threshold: number;
  release_threshold: number;
  debounce_ms: number;
  capture_interval_ms: number;
  min_visibility: number;
  tolerance_seconds: number;
  warning_min_frames: number;
  remind_interval: number;
  view_mode: 'side' | 'front';
  camera_state: CameraState;
}

export interface AckAlertRequest {
  event_id: number;
}

export interface AckAlertResponse {
  ok: boolean;
}

export interface MuteAlertRequest {
  minutes: number;
}

export interface MuteAlertResponse {
  muted_until: string; // ISO 8601 UTC
}

