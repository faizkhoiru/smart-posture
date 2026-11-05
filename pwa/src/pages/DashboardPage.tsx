import React, { useState } from 'react';
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
  const [activeViewMode, setActiveViewMode] = useState<'side' | 'front'>('side');

  const chair = state?.chair ?? 'empty';
  const posture = state?.posture ?? null;
  const analysis = state?.analysis ?? 'ok';
  const load = state?.load ?? { kg: null, is_estimate: true };

  const chairInfo = getChairStatusInfo(chair);
  const postureInfo = getPostureStatusInfo(posture, analysis);

  // Status Utama (Hero Indicator)
  let heroTitle = 'Kursi Kosong';
  let heroSubtitle = 'Silakan duduk di kursi untuk memulai pemantauan postur otomatis.';
  let heroBadgeClass = 'bg-white/5 text-slate-300 border-white/10';
  let heroDot = 'bg-slate-500';

  if (chair === 'occupied') {
    if (analysis === 'analysis_unavailable') {
      heroTitle = 'Analisis Tidak Tersedia';
      heroSubtitle = 'Layanan inferensi pose sedang mengalami kendala teknis.';
      heroBadgeClass = 'bg-amber-500/10 text-amber-300 border-amber-500/30';
      heroDot = 'bg-amber-400';
    } else if (posture === 'good_posture') {
      heroTitle = 'Postur Baik';
      heroSubtitle = 'Posisi duduk Anda tegak dan ergonomis. Pertahankan posisi ini!';
      heroBadgeClass = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
      heroDot = 'bg-emerald-400 shadow-[0_0_10px_#34d399]';
    } else if (posture === 'warning') {
      heroTitle = 'Perlu Perbaikan';
      heroSubtitle = 'Punggung mulai condong membungkuk. Luruskan tubuh secara perlahan.';
      heroBadgeClass = 'bg-amber-500/10 text-amber-300 border-amber-500/30';
      heroDot = 'bg-amber-400 shadow-[0_0_10px_#fbbf24]';
    } else if (posture === 'bad_posture') {
      heroTitle = 'Perlu Perbaikan';
      heroSubtitle = 'Postur membungkuk melebihi batas toleransi. Tegakkan tubuh kembali.';
      heroBadgeClass = 'bg-rose-500/10 text-rose-300 border-rose-500/30';
      heroDot = 'bg-rose-400 animate-pulse shadow-[0_0_12px_#f87171]';
    } else if (posture === 'pose_unavailable') {
      heroTitle = 'Pose Tidak Terlihat';
      heroSubtitle = 'Pastikan tubuh menghadap ke kamera dengan pencahayaan yang cukup.';
      heroBadgeClass = 'bg-white/5 text-slate-300 border-white/10';
      heroDot = 'bg-slate-400';
    }
  }

  return (
    <div className="space-y-8 pb-28 pt-2 sm:pt-6">
      {/* Hero Headline (Stitch Style: Big Bold Typography with Ambient Subtitle) */}
      <div className="text-center space-y-3 max-w-2xl mx-auto px-4">
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
          Pantau Postur <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-purple-400 via-indigo-300 to-blue-400 bg-clip-text text-transparent">
            Secara Real-Time
          </span>
        </h1>
        <p className="text-sm sm:text-base text-slate-400 font-normal leading-relaxed">
          Koreksi kebiasaan duduk Anda secara cerdas dengan analisis AI dan sensor IoT.
        </p>
      </div>

      {/* Alert Banner / Audio Reminder Panel (Fase 6B) */}
      <ReminderPanel
        alert={alert}
        mutedUntil={state?.muted_until ?? null}
        isAudioUnlocked={isAudioUnlocked}
        isSpeaking={isSpeaking}
        onAck={onAckAlert}
        onMute={onMuteAlert}
        onUnlockAudio={onUnlockAudio}
      />

      {/* Centerpiece Hero Glass Card (Inspired by the Stitch Prompt Box) */}
      <div className="relative rounded-3xl bg-[#0c0d16]/80 backdrop-blur-2xl border border-white/10 p-5 sm:p-7 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] transition-all">
        {/* Card Header: Live Status & Sensor Badges */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <span className={`w-3 h-3 rounded-full ${heroDot} shrink-0`} />
            <span className="text-base sm:text-lg font-bold text-white tracking-tight">
              {heroTitle}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${heroBadgeClass}`}>
              {chairInfo.label}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300">
              ⚖️ {load.kg !== null && chair === 'occupied' ? `${load.kg.toFixed(1)} kg` : '0.0 kg'}
              {load.is_estimate && <span className="text-[10px] text-amber-400 ml-1">(Est.)</span>}
            </span>
          </div>
        </div>

        {/* Card Body: Interactive Visualizer & Subtitle */}
        <div className="py-5 space-y-4">
          <p className="text-xs sm:text-sm text-slate-300">
            {heroSubtitle}
          </p>

          <PoseSkeleton
            keypoints={pose?.keypoints ?? []}
            confidence={pose?.confidence ?? 0}
            postureState={posture}
            cameraState={state?.camera ?? 'off'}
          />
        </div>

        {/* Card Footer: Pill Switcher & Quick Controls (Stitch Footer Style) */}
        <div className="pt-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-3">
          {/* View Mode Pill Switcher (like Stitch [App | Web] selector) */}
          <div className="flex items-center p-1 bg-black/40 rounded-full border border-white/10 text-xs">
            <button
              onClick={() => setActiveViewMode('side')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all font-medium ${
                activeViewMode === 'side'
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>👤</span>
              <span>Tampak Samping</span>
            </button>
            <button
              onClick={() => setActiveViewMode('front')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all font-medium ${
                activeViewMode === 'front'
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>👥</span>
              <span>Tampak Depan</span>
            </button>
          </div>

          {/* Status Note Pill */}
          <div className="text-[11px] font-medium text-slate-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            <span>Kamera Memori (Privasi Aktif)</span>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Glass Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Okupansi & Beban */}
        <div className="rounded-2xl bg-[#0c0d16]/60 backdrop-blur-xl border border-white/10 p-5 hover:border-white/20 transition-all">
          <div className="text-xs font-medium text-slate-400 mb-2">Beban Kursi (Load Cell)</div>
          <div className="text-2xl font-bold font-mono text-white">
            {load.kg !== null && chair === 'occupied' ? `${load.kg.toFixed(1)} kg` : '0.0 kg'}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {chair === 'occupied'
              ? 'Dua sensor load cell 50 kg mendeteksi pengguna aktif.'
              : 'Kursi dalam kondisi kosong.'}
          </p>
        </div>

        {/* Card 2: Kategori Postur */}
        <div className="rounded-2xl bg-[#0c0d16]/60 backdrop-blur-xl border border-white/10 p-5 hover:border-white/20 transition-all">
          <div className="text-xs font-medium text-slate-400 mb-2">Kategori Postur</div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg border ${postureInfo.colorClasses}`}>
              {postureInfo.label}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {postureInfo.description}
          </p>
        </div>

        {/* Card 3: Privasi by Design */}
        <div className="rounded-2xl bg-[#0c0d16]/60 backdrop-blur-xl border border-white/10 p-5 hover:border-white/20 transition-all">
          <div className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
            <span>🛡️</span>
            <span>Privasi Terjaga</span>
          </div>
          <div className="text-sm font-semibold text-slate-200">
            Tanpa Penyimpanan Foto
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Snapshot JPEG hanya diproses di RAM untuk koordinat keypoints, lalu langsung dihapus.
          </p>
        </div>
      </div>
    </div>
  );
};
