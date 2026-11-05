import React, { useState, useEffect } from 'react';
import { apiClient, ApiClientError } from '../api/client';
import type { DeviceConfig } from '../types/api';
import { CONSENT_STORAGE_KEY } from '../components/ConsentModal';

interface SettingsPageProps {
  deviceId: string;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ deviceId }) => {
  const [config, setConfig] = useState<DeviceConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [audioTestStatus, setAudioTestStatus] = useState<string>('');

  // Muat konfigurasi aktif saat halaman dibuka
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setLoadError(null);

    apiClient
      .getConfig(deviceId)
      .then((cfg) => {
        if (isMounted) {
          setConfig(cfg);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Gagal mengambil konfigurasi:', err);
        if (isMounted) {
          // Fallback default config jika endpoint belum siap
          setConfig({
            occupied_threshold: 20.0,
            release_threshold: 10.0,
            debounce_ms: 2000,
            capture_interval_ms: 1000,
            min_visibility: 0.5,
            tolerance_seconds: 7,
            warning_min_frames: 5,
            remind_interval: 60,
            view_mode: 'side',
            camera_state: 'on'
          });
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [deviceId]);

  const validate = (): boolean => {
    if (!config) return false;
    const errors: Record<string, string> = {};

    if (config.occupied_threshold <= config.release_threshold) {
      errors.occupied_threshold = 'Ambang okupansi harus lebih besar dari ambang pelepasan.';
    }
    if (config.release_threshold <= 0) {
      errors.release_threshold = 'Ambang pelepasan harus lebih besar dari 0 kg.';
    }
    if (config.tolerance_seconds < 2 || config.tolerance_seconds > 60) {
      errors.tolerance_seconds = 'Durasi toleransi antara 2 hingga 60 detik.';
    }
    if (config.warning_min_frames < 2 || config.warning_min_frames > 30) {
      errors.warning_min_frames = 'Jumlah frame warning minimal 2 frame.';
    }
    if (config.capture_interval_ms < 200 || config.capture_interval_ms > 5000) {
      errors.capture_interval_ms = 'Interval snapshot kamera antara 200ms - 5000ms.';
    }
    if (config.remind_interval < 10 || config.remind_interval > 300) {
      errors.remind_interval = 'Interval pengingat antara 10 hingga 300 detik.';
    }
    if (config.min_visibility < 0.1 || config.min_visibility > 0.95) {
      errors.min_visibility = 'Minimal visibility antara 0.1 hingga 0.95.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    if (!validate()) {
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await apiClient.updateConfig(deviceId, config);
      setConfig(res.config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Gagal menyimpan pengaturan.';
      alert(`Galat: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const testAudioVoice = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setAudioTestStatus('Peramban Anda tidak mendukung Web Speech API.');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      'Uji coba suara pengingat: Silakan tegakkan punggung Anda dengan rileks.'
    );
    utterance.lang = 'id-ID';
    utterance.rate = 0.95;

    utterance.onstart = () => setAudioTestStatus('Sedang memutar suara uji coba...');
    utterance.onend = () => setAudioTestStatus('Uji coba suara selesai.');
    utterance.onerror = () => setAudioTestStatus('Galat saat memutar suara.');

    window.speechSynthesis.speak(utterance);
  };

  const resetConsent = () => {
    try {
      localStorage.removeItem(CONSENT_STORAGE_KEY);
      window.location.reload();
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="bg-[#0c0d16]/80 border border-white/10 rounded-3xl p-10 text-center text-slate-400 text-xs">
        <span className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin inline-block mb-2" />
        <p>Memuat konfigurasi perangkat...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-[#0c0d16]/80 border border-white/10 rounded-3xl p-8 text-center space-y-4">
        <p className="text-rose-400 text-xs font-semibold">{loadError}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2 bg-white text-slate-950 text-xs font-bold rounded-full hover:bg-slate-200 transition"
        >
          Muat Ulang Halaman
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28 pt-2 sm:pt-6">
      {/* Page Title */}
      <div className="text-center space-y-2 max-w-xl mx-auto">
        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
          Pengaturan Sistem
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Konfigurasi sensitivitas sensor okupansi, batas toleransi temporal, dan interval suara.
        </p>
      </div>

      <div className="bg-[#0c0d16]/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)]">
        {/* Konfirmasi Sukses Simpan */}
        {saveSuccess && (
          <div className="mb-6 p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl text-xs text-emerald-200 flex items-center gap-2.5 animate-fadeIn">
            <span className="text-emerald-400 text-base">✓</span>
            <span>Pengaturan berhasil disimpan dan dikirim ke perangkat {deviceId}.</span>
          </div>
        )}

        {config && (
          <form onSubmit={handleSave} className="space-y-6">
            {/* 1. Sensitivitas Okupansi Kursi */}
            <div className="space-y-4 bg-white/5 p-5 rounded-2xl border border-white/5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300">
                1. Sensor Okupansi Kursi (Load Cell)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1.5">
                    Ambang Duduk / Occupied (kg)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={config.occupied_threshold}
                    onChange={(e) =>
                      setConfig({ ...config, occupied_threshold: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-black/50 border border-white/10 rounded-full px-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                  {validationErrors.occupied_threshold && (
                    <p className="text-[11px] text-rose-400 mt-1">{validationErrors.occupied_threshold}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1.5">
                    Ambang Kosong / Release (kg)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={config.release_threshold}
                    onChange={(e) =>
                      setConfig({ ...config, release_threshold: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-black/50 border border-white/10 rounded-full px-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                  {validationErrors.release_threshold && (
                    <p className="text-[11px] text-rose-400 mt-1">{validationErrors.release_threshold}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1.5">
                  Debounce Perubahan Okupansi (ms)
                </label>
                <input
                  type="number"
                  step="100"
                  value={config.debounce_ms}
                  onChange={(e) =>
                    setConfig({ ...config, debounce_ms: parseInt(e.target.value) || 0 })
                  }
                  className="w-full sm:w-1/2 bg-black/50 border border-white/10 rounded-full px-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>
            </div>

            {/* 2. Logika Deteksi Postur & Toleransi */}
            <div className="space-y-4 bg-white/5 p-5 rounded-2xl border border-white/5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300">
                2. Deteksi Postur & Toleransi Temporal
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1.5">
                    Durasi Toleransi Membungkuk (detik)
                  </label>
                  <input
                    type="number"
                    value={config.tolerance_seconds}
                    onChange={(e) =>
                      setConfig({ ...config, tolerance_seconds: parseInt(e.target.value) || 0 })
                    }
                    className="w-full bg-black/50 border border-white/10 rounded-full px-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Batas waktu peringatan sebelum status bad_posture.</p>
                  {validationErrors.tolerance_seconds && (
                    <p className="text-[11px] text-rose-400 mt-1">{validationErrors.tolerance_seconds}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1.5">
                    Minimal Frame Warning (frame)
                  </label>
                  <input
                    type="number"
                    value={config.warning_min_frames}
                    onChange={(e) =>
                      setConfig({ ...config, warning_min_frames: parseInt(e.target.value) || 0 })
                    }
                    className="w-full bg-black/50 border border-white/10 rounded-full px-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Mencegah alarm palsu dari 1 frame anomali.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1.5">
                    Orientasi Kamera (View Mode)
                  </label>
                  <select
                    value={config.view_mode}
                    onChange={(e) =>
                      setConfig({ ...config, view_mode: e.target.value as 'side' | 'front' })
                    }
                    className="w-full bg-black/50 border border-white/10 rounded-full px-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="side">Tampak Samping (Side View)</option>
                    <option value="front">Tampak Depan (Front View)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1.5">
                    Minimal Keypoint Visibility (0.1–0.9)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    max="0.9"
                    value={config.min_visibility}
                    onChange={(e) =>
                      setConfig({ ...config, min_visibility: parseFloat(e.target.value) || 0.5 })
                    }
                    className="w-full bg-black/50 border border-white/10 rounded-full px-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* 3. Pengaturan Audio & Pengingat */}
            <div className="space-y-4 bg-white/5 p-5 rounded-2xl border border-white/5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300">
                3. Interval Pengingat Suara
              </h3>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1.5">
                  Interval Pengulangan Suara (detik)
                </label>
                <input
                  type="number"
                  value={config.remind_interval}
                  onChange={(e) =>
                    setConfig({ ...config, remind_interval: parseInt(e.target.value) || 60 })
                  }
                  className="w-full sm:w-1/2 bg-black/50 border border-white/10 rounded-full px-4 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Jeda waktu sebelum pengingat berbunyi ulang bila postur belum dikoreksi.
                </p>
                {validationErrors.remind_interval && (
                  <p className="text-[11px] text-rose-400 mt-1">{validationErrors.remind_interval}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-7 py-2.5 bg-white text-slate-950 hover:bg-slate-200 disabled:bg-white/10 disabled:text-slate-500 rounded-full text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-white/10 active:scale-95"
              >
                {saving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                    <span>Menyimpan Pengaturan...</span>
                  </>
                ) : (
                  <span>Simpan Pengaturan Perangkat</span>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Bagian Uji Suara & Privasi */}
        <div className="mt-8 pt-6 border-t border-white/10 space-y-4">
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-white">Uji Pengucapan Web Speech API (id-ID)</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Tes suara pengingat ramah berbahasa Indonesia.</p>
              {audioTestStatus && <p className="text-[11px] text-purple-300 mt-1">{audioTestStatus}</p>}
            </div>
            <button
              type="button"
              onClick={testAudioVoice}
              className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full text-xs font-semibold border border-white/10 shrink-0 transition"
            >
              🔊 Uji Suara
            </button>
          </div>

          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-white">Lembar Persetujuan Privasi</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Buka kembali dialog persetujuan pemantauan ergonomis.</p>
            </div>
            <button
              type="button"
              onClick={resetConsent}
              className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-slate-300 rounded-full text-xs font-semibold border border-white/10 shrink-0 transition"
            >
              Tinjau Persetujuan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
