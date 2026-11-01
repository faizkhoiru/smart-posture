import React from 'react';
import type { ConnectionStatus, DeviceState, AnalysisState } from '../types/ws';

interface AlertBannerProps {
  connectionStatus: ConnectionStatus;
  deviceStatus?: DeviceState;
  analysisStatus?: AnalysisState;
  reconnectCount?: number;
  onRetryConnection?: () => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  connectionStatus,
  deviceStatus = 'online',
  analysisStatus = 'ok',
  reconnectCount = 0,
  onRetryConnection
}) => {
  // 1. Prioritas tertinggi: WebSocket putus
  if (connectionStatus === 'disconnected' || connectionStatus === 'reconnecting') {
    return (
      <div className="bg-rose-950/80 border-b border-rose-600/40 px-4 py-3 text-rose-200">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
            <div className="text-xs sm:text-sm">
              <span className="font-semibold text-rose-100">
                {connectionStatus === 'reconnecting'
                  ? `Koneksi Server Terputus (Mencoba ulang #${reconnectCount})...`
                  : 'Koneksi Server Terputus.'}
              </span>{' '}
              Data yang tampil mungkin tidak mutakhir.
            </div>
          </div>
          {onRetryConnection && (
            <button
              onClick={onRetryConnection}
              className="px-3 py-1 bg-rose-800/80 hover:bg-rose-700/80 text-white rounded text-xs font-medium border border-rose-500/40 transition shrink-0"
            >
              Coba Sambung Sekarang
            </button>
          )}
        </div>
      </div>
    );
  }

  // 2. Hardware offline
  if (deviceStatus === 'offline') {
    return (
      <div className="bg-amber-950/80 border-b border-amber-600/40 px-4 py-2.5 text-amber-200">
        <div className="max-w-4xl mx-auto flex items-center gap-2.5 text-xs sm:text-sm">
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          <div>
            <strong className="text-amber-100">Perangkat IoT Offline:</strong> Tidak ada sinyal heartbeat dari kursi.
            Pastikan ESP32 terhubung ke Wi-Fi dan daya aktif.
          </div>
        </div>
      </div>
    );
  }

  // 3. Hardware sensor error
  if (deviceStatus === 'sensor_error') {
    return (
      <div className="bg-rose-950/80 border-b border-rose-600/40 px-4 py-2.5 text-rose-200">
        <div className="max-w-4xl mx-auto flex items-center gap-2.5 text-xs sm:text-sm">
          <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
          <div>
            <strong className="text-rose-100">Gangguan Sensor Kursi:</strong> Load cell atau sirkuit timbangan kursi melaporkan error.
            Deteksi okupansi dinonaktifkan sementara.
          </div>
        </div>
      </div>
    );
  }

  // 4. Analisis tidak tersedia
  if (analysisStatus === 'analysis_unavailable') {
    return (
      <div className="bg-yellow-950/80 border-b border-yellow-600/40 px-4 py-2.5 text-yellow-200">
        <div className="max-w-4xl mx-auto flex items-center gap-2.5 text-xs sm:text-sm">
          <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
          <div>
            <strong className="text-yellow-100">Analisis Postur Tidak Tersedia:</strong> Modul pose backend mengalami kendala atau beban penuh.
            Status postur tidak dapat dipastikan saat ini.
          </div>
        </div>
      </div>
    );
  }

  return null;
};

