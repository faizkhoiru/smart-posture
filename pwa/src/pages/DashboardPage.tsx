import React from 'react';
import type { WsStateMessage, WsPoseMessage, WsAlertMessage } from '../types/ws';
import { PoseSkeleton } from '../components/PoseSkeleton';
import { ReminderPanel } from '../components/ReminderPanel';
import { getChairStatusInfo, getPostureStatusInfo } from '../utils/statusMapping';

interface DashboardPageProps {
  state: WsStateMessage | null;
  pose: WsPoseMessage | null;
  alert: WsAlertMessage | null;
  isAudioUnlocked: boolean;
  isSpeaking: boolean;
  onAckAlert: (eventId: number) => void;
  onMuteAlert: (minutes: number) => void;
  onUnlockAudio: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  state,
  pose,
  alert,
  isAudioUnlocked,
  isSpeaking,
  onAckAlert,
  onMuteAlert,
  onUnlockAudio
}) => {
  const chair = state?.chair ?? 'empty';
  const posture = state?.posture ?? null;
  const analysis = state?.analysis ?? 'ok';
  const load = state?.load ?? { kg: null, is_estimate: true };

  const chairInfo = getChairStatusInfo(chair);
  const postureInfo = getPostureStatusInfo(posture, analysis);

  // Status Utama (Hero Indicator)
  let heroTitle = 'Kursi Kosong';
  let heroSubtitle = 'Duduklah di kursi untuk memulai pemantauan postur otomatis.';
  let heroColor = 'border-slate-700 bg-slate-800/60 text-slate-200';
  let heroDot = 'bg-slate-500';

  if (chair === 'occupied') {
    if (analysis === 'analysis_unavailable') {
      heroTitle = 'Analisis Tidak Tersedia';
      heroSubtitle = 'Layanan pose sedang mengalami kendala. Postur tidak dapat dianalisis saat ini.';
      heroColor = 'border-amber-500/40 bg-amber-950/20 text-amber-200';
      heroDot = 'bg-amber-400';
    } else if (posture === 'good_posture') {
      heroTitle = 'Postur Baik';
      heroSubtitle = 'Posisi duduk Anda tegak dan ergonomis. Pertahankan kebiasaan baik ini!';
      heroColor = 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200';
      heroDot = 'bg-emerald-400';
    } else if (posture === 'warning') {
      heroTitle = 'Perlu Perbaikan';
      heroSubtitle = 'Tubuh mulai condong membungkuk. Luruskan punggung secara perlahan.';
      heroColor = 'border-amber-500/40 bg-amber-950/20 text-amber-200';
      heroDot = 'bg-amber-400';
    } else if (posture === 'bad_posture') {
      heroTitle = 'Perlu Perbaikan';
      heroSubtitle = 'Postur membungkuk melebihi toleransi. Silakan tegakkan tubuh kembali.';
      heroColor = 'border-rose-500/40 bg-rose-950/20 text-rose-200';
      heroDot = 'bg-rose-400 animate-pulse';
    } else if (posture === 'pose_unavailable') {
      heroTitle = 'Pose Tidak Terlihat';
      heroSubtitle = 'Pastikan tubuh menghadap ke kamera dengan pencahayaan yang cukup.';
      heroColor = 'border-slate-700 bg-slate-800/60 text-slate-300';
      heroDot = 'bg-slate-400';
    }
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Panel Pengingat Suara & Alert Terpadu (Fase 6B) */}
      <ReminderPanel
        alert={alert}
        mutedUntil={state?.muted_until ?? null}
        isAudioUnlocked={isAudioUnlocked}
        isSpeaking={isSpeaking}
        onAck={onAckAlert}
        onMute={onMuteAlert}
        onUnlockAudio={onUnlockAudio}
      />

      {/* Hero Status Utama */}
      <div className={`p-4 sm:p-5 rounded-2xl border ${heroColor} shadow-sm transition-all`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={`w-3.5 h-3.5 rounded-full ${heroDot} shrink-0`} />
            <h2 className="text-lg sm:text-xl font-bold tracking-tight">{heroTitle}</h2>
          </div>
          <span className="px-2.5 py-0.5 text-xs rounded-full font-medium bg-slate-900/40 border border-slate-700/50">
            {chairInfo.label}
          </span>
        </div>
        <p className="text-xs sm:text-sm text-slate-300 mt-2">{heroSubtitle}</p>
      </div>

      {/* Grid: Pose Skeleton (Kiri/Atas) & Ringkasan (Kanan/Bawah) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Canvas Skeleton */}
        <div className="md:col-span-7 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Visualisasi Tulang & Keypoints
            </h2>
            <span className="text-[11px] text-slate-400">MediaPipe Pose AI</span>
          </div>
          <PoseSkeleton
            keypoints={pose?.keypoints ?? []}
            confidence={pose?.confidence ?? 0}
            postureState={posture}
            cameraState={state?.camera ?? 'off'}
            className="flex-1"
          />
        </div>

        {/* Panel Ringkasan Metrik */}
        <div className="md:col-span-5 flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Ringkasan Sensor & Okupansi
          </h2>

          {/* Kartu Beban Kursi */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Beban Kursi (Load Cell)</span>
              {load.is_estimate && (
                <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded">
                  Estimasi
                </span>
              )}
            </div>
            <div className="text-2xl font-bold font-mono text-slate-100">
              {load.kg !== null && chair === 'occupied' ? `${load.kg.toFixed(1)} kg` : '0.0 kg'}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {chair === 'occupied'
                ? load.is_estimate
                  ? 'Nilai estimasi sebelum kalibrasi bobot standar.'
                  : 'Beban terkalibrasi akurat.'
                : 'Kursi dalam kondisi kosong tanpa beban.'}
            </p>
          </div>

          {/* Kartu Status Analisis Postur */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
            <div className="text-xs text-slate-400 mb-1">Kategori Postur Saat Ini</div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 text-xs font-medium rounded-lg border ${postureInfo.colorClasses}`}>
                {postureInfo.label}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">{postureInfo.description}</p>
          </div>

          {/* Kartu Status Privasi & Kamera */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex items-start gap-3">
            <div className="text-xl">🛡️</div>
            <div className="text-xs text-slate-300">
              <div className="font-semibold text-slate-200">Privasi Terjaga</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Kamera hanya memproses frame di memori untuk estimasi titik pose saat Anda duduk. Gambar tidak pernah disimpan ke server atau disk.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
