import type {
  ChairState,
  PostureState,
  DeviceState,
  AnalysisState,
  ConnectionStatus
} from '../types/ws';

export interface StatusBadge {
  label: string;
  description: string;
  variant: 'success' | 'warning' | 'danger' | 'neutral' | 'info';
  colorClasses: string;
}

export function getChairStatusInfo(chair: ChairState): StatusBadge {
  switch (chair) {
    case 'occupied':
      return {
        label: 'Pengguna Terdeteksi',
        description: 'Kursi sedang diduduki.',
        variant: 'success',
        colorClasses: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      };
    case 'empty':
      return {
        label: 'Kursi Kosong',
        description: 'Tidak ada beban di atas kursi.',
        variant: 'neutral',
        colorClasses: 'bg-slate-700/50 text-slate-300 border-slate-600/40'
      };
    case 'calibrating':
      return {
        label: 'Sedang Kalibrasi',
        description: 'Sensor kursi sedang dalam proses kalibrasi.',
        variant: 'info',
        colorClasses: 'bg-blue-500/15 text-blue-400 border-blue-500/30'
      };
  }
}

export function getPostureStatusInfo(
  posture: PostureState,
  analysis: AnalysisState = 'ok'
): StatusBadge {
  if (analysis === 'analysis_unavailable') {
    return {
      label: 'Analisis Tidak Tersedia',
      description: 'Layanan pose backend sedang tidak dapat memproses gambar.',
      variant: 'warning',
      colorClasses: 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    };
  }

  switch (posture) {
    case 'good_posture':
      return {
        label: 'Postur Baik',
        description: 'Posisi tulang belakang dan kepala tegak sejajar.',
        variant: 'success',
        colorClasses: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      };
    case 'warning':
      return {
        label: 'Perlu Perbaikan (Peringatan)',
        description: 'Mulai condong ke depan. Pertahankan posisi tegak.',
        variant: 'warning',
        colorClasses: 'bg-amber-500/15 text-amber-400 border-amber-500/30'
      };
    case 'bad_posture':
      return {
        label: 'Perlu Perbaikan (Membungkuk)',
        description: 'Postur membungkuk terdeteksi melewati batas toleransi.',
        variant: 'danger',
        colorClasses: 'bg-rose-500/15 text-rose-400 border-rose-500/30'
      };
    case 'pose_unavailable':
      return {
        label: 'Pose Tidak Terlihat',
        description: 'Tubuh tidak terdeteksi jelas dalam frame kamera.',
        variant: 'neutral',
        colorClasses: 'bg-slate-700/50 text-slate-300 border-slate-600/40'
      };
    case null:
      return {
        label: 'Tidak Aktif',
        description: 'Analisis postur hanya berjalan saat kursi terisi.',
        variant: 'neutral',
        colorClasses: 'bg-slate-800/60 text-slate-400 border-slate-700/40'
      };
  }
}

export function getDeviceStatusInfo(device: DeviceState): StatusBadge {
  switch (device) {
    case 'online':
      return {
        label: 'Perangkat Online',
        description: 'ESP32 terhubung dan mengirim heartbeat normal.',
        variant: 'success',
        colorClasses: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      };
    case 'offline':
      return {
        label: 'Perangkat Offline',
        description: 'Heartbeat perangkat tidak terdeteksi (melebihi batas timeout).',
        variant: 'danger',
        colorClasses: 'bg-rose-500/15 text-rose-400 border-rose-500/30'
      };
    case 'sensor_error':
      return {
        label: 'Kerusakan Sensor',
        description: 'Load cell atau modul HX711 melaporkan galat bacaan.',
        variant: 'danger',
        colorClasses: 'bg-rose-500/15 text-rose-400 border-rose-500/30'
      };
  }
}

export function getConnectionStatusInfo(status: ConnectionStatus): StatusBadge {
  switch (status) {
    case 'connected':
      return {
        label: 'Terhubung',
        description: 'WebSocket real-time aktif.',
        variant: 'success',
        colorClasses: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      };
    case 'connecting':
      return {
        label: 'Menghubungkan...',
        description: 'Sedang membuka saluran data real-time.',
        variant: 'info',
        colorClasses: 'bg-blue-500/15 text-blue-400 border-blue-500/30'
      };
    case 'reconnecting':
      return {
        label: 'Menghubungkan Ulang...',
        description: 'Koneksi terputus, mencoba menyambung kembali otomatis.',
        variant: 'warning',
        colorClasses: 'bg-amber-500/15 text-amber-400 border-amber-500/30'
      };
    case 'disconnected':
      return {
        label: 'Terputus',
        description: 'Koneksi ke backend mati.',
        variant: 'danger',
        colorClasses: 'bg-rose-500/15 text-rose-400 border-rose-500/30'
      };
  }
}

