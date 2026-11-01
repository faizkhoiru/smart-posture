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
    <div className="bg-rose-950/70 border border-rose-500/50 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5 text-rose-100 animate-fadeIn">
      {/* Alert Header & Pesan Sopan */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-lg shrink-0">
            🔔
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-rose-100">
                Pengingat Postur Duduk
              </h2>
              {isSpeaking && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/30 text-rose-200 border border-rose-500/50 animate-pulse">
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
          <span className="px-2.5 py-1 text-xs font-mono font-medium rounded-lg bg-slate-800/80 text-amber-300 border border-amber-500/30 shrink-0">
            Dijeda: {mutedTimeText}
          </span>
        )}
      </div>

      {/* Kotak Instruksi Autoplay bila Audio Belum Diaktifkan (Skenario 11) */}
      {!isAudioUnlocked && (
        <div className="bg-amber-950/60 border border-amber-500/40 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 text-xs text-amber-200">
            <span className="text-base shrink-0">🔇</span>
            <span>
              <strong>Suara otomatis diblokir peramban.</strong> Klik tombol untuk mengizinkan panduan suara berbahasa Indonesia.
            </span>
          </div>
          <button
            onClick={onUnlockAudio}
            className="w-full sm:w-auto px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition shrink-0 shadow-sm"
          >
            Aktifkan Suara
          </button>
        </div>
      )}

      {/* Tombol Aksi Pengguna */}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-rose-900/40">
        <button
          onClick={() => onMute(5)}
          disabled={currentlyMuted}
          className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition ${
            currentlyMuted
              ? 'bg-slate-800/40 text-slate-500 border-slate-700/40 cursor-not-allowed'
              : 'bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border-slate-600'
          }`}
          title="Tunda notifikasi dan suara selama 5 menit"
        >
          {currentlyMuted ? 'Sedang Dijeda' : 'Jeda 5 Menit'}
        </button>

        <button
          onClick={() => onAck(alert.event_id)}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition shadow-md shadow-rose-600/30"
          title="Catat bahwa Anda telah menyadari pengingat ini"
        >
          Saya Mengerti
        </button>
      </div>
    </div>
  );
};

