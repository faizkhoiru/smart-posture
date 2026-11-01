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
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
        <span className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin inline-block mb-2" />
        <p>Memuat pengaturan perangkat...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 text-center space-y-3">
        <p className="text-rose-400 text-xs font-semibold">{loadError}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-slate-800 text-xs text-slate-200 rounded-lg hover:bg-slate-700 transition"
        >
          Muat Ulang Halaman
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="border-b border-slate-800 pb-3 mb-5">
          <h2 className="text-lg font-bold text-slate-100">Pengaturan Sistem & Toleransi Postur</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Sesuaikan sensitivitas sensor okupansi, batas waktu toleransi membungkuk, dan interval pengingat.
          </p>
        </div>

        {/* Konfirmasi Sukses Simpan */}
        {saveSuccess && (
          <div className="mb-4 p-3.5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 flex items-center gap-2 animate-fadeIn">
            <span className="text-emerald-400 text-base">✓</span>
            <span>Pengaturan berhasil disimpan dan dikirim ke perangkat {deviceId}.</span>
          </div>
        )}

        {config && (
          <form onSubmit={handleSave} className="space-y-6">
            {/* 1. Sensitivitas Okupansi Kursi */}
            <div className="space-y-3 bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                1. Sensor Okupansi Kursi (Load Cell)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">
                    Ambang Duduk / Occupied (kg)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={config.occupied_threshold}
                    onChange={(e) =>
                      setConfig({ ...config, occupied_threshold: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  {validationErrors.occupied_threshold && (
                    <p className="text-[11px] text-rose-400 mt-1">{validationErrors.occupied_threshold}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">
                    Ambang Kosong / Release (kg)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={config.release_threshold}
                    onChange={(e) =>
                      setConfig({ ...config, release_threshold: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  {validationErrors.release_threshold && (
                    <p className="text-[11px] text-rose-400 mt-1">{validationErrors.release_threshold}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  Debounce Perubahan Okupansi (ms)
                </label>
                <input
                  type="number"
                  step="100"
                  value={config.debounce_ms}
                  onChange={(e) =>
                    setConfig({ ...config, debounce_ms: parseInt(e.target.value) || 0 })
                  }
                  className="w-full sm:w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            {/* 2. Logika Deteksi Postur & Toleransi */}
            <div className="space-y-3 bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                2. Deteksi Postur & Toleransi Temporal
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">
                    Durasi Toleransi Membungkuk (detik)
                  </label>
                  <input
                    type="number"
                    value={config.tolerance_seconds}
                    onChange={(e) =>
                      setConfig({ ...config, tolerance_seconds: parseInt(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Waktu warning sebelum bad_posture.</p>
                  {validationErrors.tolerance_seconds && (
                    <p className="text-[11px] text-rose-400 mt-1">{validationErrors.tolerance_seconds}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">
                    Minimal Frame Warning (frame)
                  </label>
                  <input
                    type="number"
                    value={config.warning_min_frames}
                    onChange={(e) =>
                      setConfig({ ...config, warning_min_frames: parseInt(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Mencegah alarm dari 1 frame anomali.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">
                    Orientasi Kamera (View Mode)
                  </label>
                  <select
                    value={config.view_mode}
                    onChange={(e) =>
                      setConfig({ ...config, view_mode: e.target.value as 'side' | 'front' })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="side">Tampak Samping (Side View)</option>
                    <option value="front">Tampak Depan (Front View)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-medium block mb-1">
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
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* 3. Pengaturan Audio & Pengingat */}
            <div className="space-y-3 bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                3. Interval Pengingat Suara
              </h3>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  Interval Pengulangan Suara (detik)
                </label>
                <input
                  type="number"
                  value={config.remind_interval}
                  onChange={(e) =>
                    setConfig({ ...config, remind_interval: parseInt(e.target.value) || 60 })
                  }
                  className="w-full sm:w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Jeda waktu sebelum pengingat suara berbunyi kembali jika postur belum diperbaiki.
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
                className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white disabled:text-slate-500 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 shadow"
              >
                {saving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
        <div className="mt-8 pt-6 border-t border-slate-800 space-y-4">
          <div className="bg-slate-800/30 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-semibold text-slate-200">Uji Pengucapan Web Speech API (id-ID)</h4>
              <p className="text-[11px] text-slate-400">Tes suara pengingat ramah berbahasa Indonesia.</p>
              {audioTestStatus && <p className="text-[11px] text-indigo-400 mt-1">{audioTestStatus}</p>}
            </div>
            <button
              type="button"
              onClick={testAudioVoice}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 shrink-0 transition"
            >
              🔊 Uji Suara
            </button>
          </div>

          <div className="bg-slate-800/30 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-semibold text-slate-200">Lembar Persetujuan Privasi</h4>
              <p className="text-[11px] text-slate-400">Buka kembali dialog persetujuan pemantauan ergonomis.</p>
            </div>
            <button
              type="button"
              onClick={resetConsent}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 shrink-0 transition"
            >
              Tinjau Persetujuan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
