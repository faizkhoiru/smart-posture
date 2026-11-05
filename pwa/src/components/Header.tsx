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
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#06070b]/80 border-b border-white/5 px-4 sm:px-8 py-3.5 transition-all">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Brand Logo & Device Info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
              SmartPosture
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-white/10 text-purple-300 border border-purple-500/30">
              BETA
            </span>
          </div>

          <div className="hidden sm:block h-4 w-px bg-white/10 mx-1" />

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="font-medium text-slate-300">{deviceName}</span>
            <span className="text-slate-600">•</span>
            <span className="text-[11px] text-slate-400 font-mono">
              {formatTime(updatedAt)}
            </span>
          </div>
        </div>

        {/* Action & Status Pill Group */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Audio Autoplay Unlock Button (Stitch 'Try Now' pill button style) */}
          {!isAudioUnlocked ? (
            <button
              onClick={onUnlockAudio}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-white text-slate-950 hover:bg-slate-200 transition-all shadow-md shadow-white/10 active:scale-95"
              title="Peramban memblokir audio otomatis. Klik untuk mengaktifkan suara pengingat."
            >
              <span className="text-sm">🔔</span>
              <span>Aktifkan Suara</span>
            </button>
          ) : (
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
              title="Suara pengingat bahasa Indonesia aktif"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Suara Aktif</span>
            </div>
          )}

          {/* Indikator Kamera (Privasi by Design) */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              cameraState === 'on'
                ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                : 'bg-white/5 text-slate-400 border-white/5'
            }`}
            title={cameraState === 'on' ? 'Kamera aktif memproses frame di memori' : 'Kamera nonaktif'}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                cameraState === 'on' ? 'bg-purple-400 shadow-[0_0_8px_#a855f7]' : 'bg-slate-500'
              }`}
            />
            <span>{cameraState === 'on' ? 'Kamera ON' : 'Kamera OFF'}</span>
          </div>

          {/* Indikator Koneksi WebSocket */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${connInfo.colorClasses}`}
            title={connInfo.description}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connectionStatus === 'connected' ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400'
              }`}
            />
            <span>{connInfo.label}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
