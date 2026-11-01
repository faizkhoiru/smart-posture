import React from 'react';
import type { ConnectionStatus, CameraState } from '../types/ws';
import { getConnectionStatusInfo } from '../utils/statusMapping';

interface HeaderProps {
  deviceName: string;
  connectionStatus: ConnectionStatus;
  cameraState?: CameraState;
  updatedAt?: string;
  isAudioUnlocked?: boolean;
  onUnlockAudio?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  deviceName,
  connectionStatus,
  cameraState = 'off',
  updatedAt,
  isAudioUnlocked = false,
  onUnlockAudio
}) => {
  const connInfo = getConnectionStatusInfo(connectionStatus);

  const formatTime = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-30 shadow-md">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Device title & subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-base shrink-0">
            SP
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-100 leading-tight">
                {deviceName}
              </h1>
            </div>
            <p className="text-xs text-slate-400">
              Pembaruan: <span className="font-mono text-slate-300">{formatTime(updatedAt)}</span>
            </p>
          </div>
        </div>

        {/* Status Indicators Pill Group */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Tombol / Indikator Audio Autoplay */}
          {!isAudioUnlocked ? (
            <button
              onClick={onUnlockAudio}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition animate-pulse"
              title="Peramban memblokir audio otomatis. Klik untuk mengaktifkan suara pengingat."
            >
              <span>🔇</span>
              <span>Aktifkan Suara</span>
            </button>
          ) : (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700/60"
              title="Suara pengingat bahasa Indonesia aktif"
            >
              <span>🔊</span>
              <span>Suara Aktif</span>
            </div>
          )}

          {/* Indikator Kamera (Privasi by Design) */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              cameraState === 'on'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700/60'
            }`}
            title={cameraState === 'on' ? 'Kamera aktif memantau postur' : 'Kamera nonaktif'}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                cameraState === 'on' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
              }`}
            />
            <span>{cameraState === 'on' ? 'Kamera Aktif' : 'Kamera Mati'}</span>
          </div>

          {/* Indikator Koneksi WebSocket */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${connInfo.colorClasses}`}
            title={connInfo.description}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connInfo.variant === 'success'
                  ? 'bg-emerald-400'
                  : connInfo.variant === 'warning'
                  ? 'bg-amber-400'
                  : connInfo.variant === 'danger'
                  ? 'bg-rose-400'
                  : 'bg-blue-400'
              }`}
            />
            <span>{connInfo.label}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
