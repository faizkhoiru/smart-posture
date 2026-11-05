import React, { useState, useEffect } from 'react';
import type { WsAlertMessage } from '../types/ws';
import { isMuted, formatMutedRemaining } from '../utils/reminderLogic';

interface ReminderPanelProps {
  alert: WsAlertMessage | null;
  mutedUntil: string | null;
  isAudioUnlocked: boolean;
  isSpeaking: boolean;
  onAck: (eventId: number) => void;
  onMute: (minutes: number) => void;
  onUnlockAudio: () => void;
}

export const ReminderPanel: React.FC<ReminderPanelProps> = ({
  alert,
  mutedUntil,
  isAudioUnlocked,
  isSpeaking,
  onAck,
  onMute,
  onUnlockAudio
}) => {
  const [mutedTimeText, setMutedTimeText] = useState<string | null>(() => formatMutedRemaining(mutedUntil));

  useEffect(() => {
    if (!mutedUntil) {
      setMutedTimeText(null);
      return;
    }

    const timer = setInterval(() => {
      const remaining = formatMutedRemaining(mutedUntil);
      setMutedTimeText(remaining);
      if (!remaining) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [mutedUntil]);

  // Sembunyikan otomatis jika tidak ada alert aktif
  if (!alert) return null;

  const currentlyMuted = isMuted(mutedUntil);

  return (
    <div className="rounded-3xl bg-rose-950/60 backdrop-blur-2xl border border-rose-500/30 p-5 sm:p-6 shadow-[0_15px_40px_-10px_rgba(239,68,68,0.25)] space-y-4 text-rose-100 transition-all">
      {/* Alert Header & Pesan Sopan */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-lg shrink-0">
            🔔
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Pengingat Postur Duduk
              </h2>
              {isSpeaking && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/30 text-rose-200 border border-rose-500/50 animate-pulse">
                  🔊 Memutar Suara...
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-rose-200 mt-1 leading-relaxed">
              {alert.message}
            </p>
          </div>
        </div>

        {currentlyMuted && mutedTimeText && (
          <span className="px-3 py-1 text-xs font-mono font-medium rounded-full bg-black/50 text-amber-300 border border-amber-500/30 shrink-0">
            Dijeda: {mutedTimeText}
          </span>
        )}
      </div>

      {/* Kotak Instruksi Autoplay bila Audio Belum Diaktifkan */}
      {!isAudioUnlocked && (
        <div className="bg-amber-950/50 border border-amber-500/30 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-amber-200">
            <span className="text-base shrink-0">🔇</span>
            <span>
              <strong>Suara otomatis diblokir peramban.</strong> Aktifkan untuk mendengarkan panduan suara bahasa Indonesia.
            </span>
          </div>
          <button
            onClick={onUnlockAudio}
            className="w-full sm:w-auto px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-full text-xs font-bold transition shrink-0 shadow-md"
          >
            Aktifkan Suara
          </button>
        </div>
      )}

      {/* Tombol Aksi Pengguna */}
      <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-rose-500/20">
        <button
          onClick={() => onMute(5)}
          disabled={currentlyMuted}
          className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
            currentlyMuted
              ? 'bg-white/5 text-slate-500 border-white/5 cursor-not-allowed'
              : 'bg-white/10 hover:bg-white/20 text-slate-200 border-white/10'
          }`}
          title="Tunda notifikasi dan suara selama 5 menit"
        >
          {currentlyMuted ? 'Sedang Dijeda' : 'Jeda 5 Menit'}
        </button>

        <button
          onClick={() => onAck(alert.event_id)}
          className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-full text-xs font-bold transition shadow-lg shadow-rose-600/30 active:scale-95"
          title="Catat bahwa Anda telah menyadari pengingat ini"
        >
          Saya Mengerti
        </button>
      </div>
    </div>
  );
};
