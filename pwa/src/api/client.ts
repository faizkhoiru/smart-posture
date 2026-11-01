import type {
  DeviceSummary,
  DeviceLatestState,
  CalibrateLoadRequest,
  CalibrateLoadResponse,
  CalibratePostureRequest,
  CalibratePostureResponse,
  SittingSession,
  PostureEvent,
  DeviceConfig,
  AckAlertRequest,
  AckAlertResponse,
  MuteAlertRequest,
  MuteAlertResponse,
  ApiError
} from '../types/api';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');

class ApiClientError extends Error {
  public code: string;
  public status: number;

  constructor(message: string, code: string = 'unknown_error', status: number = 500) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorBody = data as ApiError | null;
    const message = errorBody?.error?.message || `HTTP Error ${response.status}: ${response.statusText}`;
    const code = errorBody?.error?.code || 'http_error';
    throw new ApiClientError(message, code, response.status);
  }

  return data as T;
}

export const apiClient = {
  /**
   * Mendapatkan daftar perangkat terdaftar
   */
  async getDevices(): Promise<DeviceSummary[]> {
    return request<DeviceSummary[]>('/api/devices');
  },

  /**
   * Mendapatkan status terbaru dari perangkat tertentu
   */
  async getLatestState(deviceId: string): Promise<DeviceLatestState> {
    return request<DeviceLatestState>(`/api/devices/${encodeURIComponent(deviceId)}/latest`);
  },

  /**
   * Melakukan kalibrasi beban (step: empty | occupied)
   */
  async calibrateLoad(deviceId: string, body: CalibrateLoadRequest): Promise<CalibrateLoadResponse> {
    return request<CalibrateLoadResponse>(`/api/devices/${encodeURIComponent(deviceId)}/calibrate/load`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  /**
   * Mengambil frame baseline postur tegak
   */
  async calibratePosture(deviceId: string, body: CalibratePostureRequest = {}): Promise<CalibratePostureResponse> {
    return request<CalibratePostureResponse>(`/api/devices/${encodeURIComponent(deviceId)}/calibrate/posture`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  /**
   * Mengambil riwayat sesi duduk
   */
  async getSessions(deviceId: string, params?: { limit?: number; offset?: number }): Promise<SittingSession[]> {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    const qs = query.toString() ? `?${query.toString()}` : '';

    return request<SittingSession[]>(`/api/devices/${encodeURIComponent(deviceId)}/sessions${qs}`);
  },

  /**
   * Mengambil riwayat event postur
   */
  async getEvents(
    deviceId: string,
    params?: { limit?: number; offset?: number; status?: string }
  ): Promise<PostureEvent[]> {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    if (params?.status) query.set('status', params.status);
    const qs = query.toString() ? `?${query.toString()}` : '';

    return request<PostureEvent[]>(`/api/devices/${encodeURIComponent(deviceId)}/events${qs}`);
  },

  /**
   * Mengambil konfigurasi aktif perangkat
   */
  async getConfig(deviceId: string): Promise<DeviceConfig> {
    return request<DeviceConfig>(`/api/devices/${encodeURIComponent(deviceId)}/config`);
  },

  /**
   * Memperbarui konfigurasi perangkat
   */
  async updateConfig(deviceId: string, config: Partial<DeviceConfig>): Promise<{ ok: boolean; config: DeviceConfig }> {
    return request<{ ok: boolean; config: DeviceConfig }>(`/api/devices/${encodeURIComponent(deviceId)}/config`, {
      method: 'PUT',
      body: JSON.stringify(config)
    });
  },

  /**
   * Mengakui peringatan postur buruk
   */
  async ackAlert(deviceId: string, body: AckAlertRequest): Promise<AckAlertResponse> {
    return request<AckAlertResponse>(`/api/devices/${encodeURIComponent(deviceId)}/alerts/ack`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  /**
   * Menjeda pengingat selama N menit
   */
  async muteAlert(deviceId: string, body: MuteAlertRequest): Promise<MuteAlertResponse> {
    return request<MuteAlertResponse>(`/api/devices/${encodeURIComponent(deviceId)}/alerts/mute`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }
};

export { ApiClientError };

