import React, { useState } from 'react';
import { apiClient, ApiClientError } from '../api/client';
import type { WsStateMessage } from '../types/ws';
import type { CalibrateLoadResponse, CalibratePostureResponse } from '../types/api';

interface CalibrationPageProps {
  state: WsStateMessage | null;
  deviceId: string;
  onFinish?: () => void;
}

type StepNumber = 1 | 2 | 3 | 4;

export const CalibrationPage: React.FC<CalibrationPageProps> = ({ state, deviceId, onFinish }) => {
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Hasil kalibrasi yang terkumpul
  const [emptyLoadResult, setEmptyLoadResult] = useState<CalibrateLoadResponse | null>(null);
  const [occupiedLoadResult, setOccupiedLoadResult] = useState<CalibrateLoadResponse | null>(null);
  const [postureResult, setPostureResult] = useState<CalibratePostureResponse | null>(null);

  // Input beban acuan pada langkah 2
  const [knownWeight, setKnownWeight] = useState<string>('65');

  // 1. Eksekusi Langkah 1: Tare Kursi Kosong
  const handleStep1Tare = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await apiClient.calibrateLoad(deviceId, { step: 'empty' });
      setEmptyLoadResult(res);
      setCurrentStep(2);
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Gagal melakukan kalibrasi kursi kosong.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Eksekusi Langkah 2: Beban Terisi
  const handleStep2Occupied = async () => {
    setLoading(true);
    setErrorMessage(null);
    const weightNum = parseFloat(knownWeight);
    if (isNaN(weightNum) || weightNum <= 0) {
      setErrorMessage('Masukkan nilai bobot acuan yang valid (misal: 60 kg).');
      setLoading(false);
      return;
    }

    try {
      const res = await apiClient.calibrateLoad(deviceId, {
        step: 'occupied',
        known_weight_kg: weightNum
      });
      setOccupiedLoadResult(res);
      setCurrentStep(3);
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Gagal melakukan kalibrasi beban kursi.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Eksekusi Langkah 3: Baseline Postur Tegak
  const handleStep3Posture = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await apiClient.calibratePosture(deviceId, { frames: 10 });
      setPostureResult(res);
      setCurrentStep(4);
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Gagal merekam baseline postur tegak.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const resetWizard = () => {
    setCurrentStep(1);
    setErrorMessage(null);
    setEmptyLoadResult(null);
    setOccupiedLoadResult(null);
    setPostureResult(null);
  };

  return (
    <div className="space-y-6 pb-28 pt-2 sm:pt-6">
      {/* Page Title */}
      <div className="text-center space-y-2 max-w-xl mx-auto">
        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
          Wizard Kalibrasi
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Sesuaikan sensor load cell dan sudut acuan postur tegak tubuh Anda dalam 3 langkah mudah.
        </p>
      </div>

      <div className="bg-[#0c0d16]/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)]">
        {/* Header Wizard & Progress Bar */}
        <div className="border-b border-white/10 pb-5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {currentStep === 1 && 'Langkah 1: Titik Nol (Tare)'}
                {currentStep === 2 && 'Langkah 2: Beban Duduk (Scale)'}
                {currentStep === 3 && 'Langkah 3: Baseline Postur Tegak'}
                {currentStep === 4 && 'Kalibrasi Selesai'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {currentStep <= 3 ? 'Ikuti petunjuk pada setiap langkah secara bertahap.' : 'Semua sensor berhasil terkalibrasi.'}
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-white/10 text-purple-300 border border-purple-500/30">
              {currentStep <= 3 ? `Langkah ${currentStep} / 3` : 'Selesai'}
            </span>
          </div>

          {/* Stepper Progress Bar */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div
              className={`h-1.5 rounded-full transition-all ${
                currentStep >= 1 ? 'bg-gradient-to-r from-purple-500 to-indigo-500 shadow-[0_0_8px_#a855f7]' : 'bg-white/10'
              }`}
            />
            <div
              className={`h-1.5 rounded-full transition-all ${
                currentStep >= 2 ? 'bg-gradient-to-r from-purple-500 to-indigo-500 shadow-[0_0_8px_#a855f7]' : 'bg-white/10'
              }`}
            />
            <div
              className={`h-1.5 rounded-full transition-all ${
                currentStep >= 3 ? 'bg-gradient-to-r from-purple-500 to-indigo-500 shadow-[0_0_8px_#a855f7]' : 'bg-white/10'
              }`}
            />
          </div>
        </div>

        {/* Notifikasi Error Ramah */}
        {errorMessage && (
          <div className="mb-5 p-4 bg-rose-950/60 border border-rose-500/40 rounded-2xl text-xs text-rose-200 flex items-start justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="text-base shrink-0">⚠️</span>
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-200 text-xs font-semibold shrink-0"
            >
              Tutup
            </button>
          </div>
        )}

        {/* LANGKAH 1: Tare Kursi Kosong */}
        {currentStep === 1 && (
          <div className="space-y-5 animate-fadeIn">
            <div className="bg-white/5 border border-white/5 rounded-2xl p-5 sm:p-6 space-y-3.5">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center text-xs border border-purple-500/30">
                  1
                </span>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Kalibrasi Kursi Kosong (Tare)
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Pastikan kursi dalam keadaan <strong>benar-benar kosong</strong> tanpa beban tas, buku, atau orang.
                Sistem akan mencatat nilai ADC tare dari kedua load cell sebagai titik acuan nol kilogram.
              </p>
              <div className="p-3 bg-black/40 rounded-xl border border-white/5 text-xs text-slate-400 flex items-center justify-between">
                <span>Status Okupansi Saat Ini:</span>
                <span className="font-semibold text-white font-mono capitalize">
                  {state?.chair ?? 'empty'}
                </span>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleStep1Tare}
                disabled={loading}
                className="w-full sm:w-auto px-6 py-2.5 bg-white text-slate-950 hover:bg-slate-200 disabled:bg-white/10 disabled:text-slate-500 rounded-full text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-white/10 active:scale-95"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                    <span>Merekam Titik Nol...</span>
                  </>
                ) : (
                  <span>Rekam Titik Nol Kursi →</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* LANGKAH 2: Duduki Kursi & Masukkan Bobot */}
        {currentStep === 2 && (
          <div className="space-y-5 animate-fadeIn">
            <div className="bg-white/5 border border-white/5 rounded-2xl p-5 sm:p-6 space-y-3.5">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center text-xs border border-purple-500/30">
                  2
                </span>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Kalibrasi Beban Duduk (Scale Factor)
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Silakan duduk di kursi dengan posisi normal. Masukkan bobot tubuh Anda (atau beban acuan yang digunakan) untuk mengkalibrasi faktor skala timbangan:
              </p>

              <div className="space-y-1.5 pt-2">
                <label className="text-xs text-slate-400 font-medium block">
                  Bobot Acuan Pengguna (kg)
                </label>
                <div className="relative max-w-xs">
                  <input
                    type="number"
                    min="10"
                    max="200"
                    step="0.5"
                    value={knownWeight}
                    onChange={(e) => setKnownWeight(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
                    placeholder="Contoh: 65"
                  />
                  <span className="absolute right-4 top-2.5 text-xs text-slate-500">kg</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                onClick={() => setCurrentStep(1)}
                disabled={loading}
                className="w-full sm:w-auto px-5 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-full text-xs font-semibold transition border border-white/5"
              >
                ← Kembali ke Langkah 1
              </button>

              <button
                onClick={handleStep2Occupied}
                disabled={loading}
                className="w-full sm:w-auto px-6 py-2.5 bg-white text-slate-950 hover:bg-slate-200 disabled:bg-white/10 disabled:text-slate-500 rounded-full text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-white/10 active:scale-95"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                    <span>Mengkalibrasi Skala...</span>
                  </>
                ) : (
                  <span>Simpan Kalibrasi Beban →</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* LANGKAH 3: Rekam Baseline Postur Tegak */}
        {currentStep === 3 && (
          <div className="space-y-5 animate-fadeIn">
            <div className="bg-white/5 border border-white/5 rounded-2xl p-5 sm:p-6 space-y-3.5">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center text-xs border border-purple-500/30">
                  3
                </span>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Perekaman Baseline Postur Tegak
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Tetap duduk di kursi, tegakkan punggung Anda dengan rileks, dan pandang lurus ke depan menghadap kamera.
                Sistem akan memotret 10 frame berturut-turut untuk menentukan sudut referensi bahu dan kepala ideal Anda.
              </p>

              <div className="p-3 bg-black/40 rounded-xl border border-white/5 text-xs text-slate-400 flex items-center justify-between">
                <span>Kamera ESP32-CAM:</span>
                <span className="font-semibold text-emerald-400 font-mono">
                  {state?.camera === 'on' ? 'Aktif' : 'Menunggu Pemicu'}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                onClick={() => setCurrentStep(2)}
                disabled={loading}
                className="w-full sm:w-auto px-5 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-full text-xs font-semibold transition border border-white/5"
              >
                ← Kembali ke Langkah 2
              </button>

              <button
                onClick={handleStep3Posture}
                disabled={loading}
                className="w-full sm:w-auto px-6 py-2.5 bg-white text-slate-950 hover:bg-slate-200 disabled:bg-white/10 disabled:text-slate-500 rounded-full text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-white/10 active:scale-95"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                    <span>Merekam 10 Frame Pose...</span>
                  </>
                ) : (
                  <span>Mulai Rekam Baseline Postur Tegak →</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* LANGKAH 4: Hasil Kalibrasi Berhasil */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-5 text-emerald-100 flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-xl shrink-0">
                ✓
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  Kalibrasi Berhasil Disimpan!
                </h3>
                <p className="text-xs text-emerald-300/90 leading-relaxed">
                  Profil timbangan dan baseline postur acuan telah disimpan ke backend. Sistem sekarang siap memantau postur duduk Anda secara akurat.
                </p>
              </div>
            </div>

            {/* Rincian Hasil */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                <div className="text-xs text-slate-400 font-medium">Kalibrasi Timbangan (Load Cell)</div>
                <div className="mt-2.5 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Nilai Tare (Titik Nol):</span>
                    <span className="font-mono text-white">
                      {emptyLoadResult?.profile?.tare ?? 124500}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Faktor Skala (Scale):</span>
                    <span className="font-mono text-white">
                      {occupiedLoadResult?.profile?.scale ?? 448.5}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
                <div className="text-xs text-slate-400 font-medium">Baseline Geometri Postur</div>
                <div className="mt-2.5 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sudut Telinga-Bahu-Pinggul:</span>
                    <span className="font-mono text-emerald-400 font-semibold">
                      {postureResult?.baseline?.side_angle ?? 93.4}°
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Offset Horizontal Kepala:</span>
                    <span className="font-mono text-white">
                      {postureResult?.baseline?.head_offset ?? 0.04}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Peringatan Baseline Jika Ada */}
            {postureResult?.warnings && postureResult.warnings.length > 0 && (
              <div className="p-3.5 bg-amber-950/50 border border-amber-500/30 rounded-2xl text-xs text-amber-200">
                <strong>Catatan Kalibrasi:</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-amber-300/80">
                  {postureResult.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                onClick={resetWizard}
                className="w-full sm:w-auto px-5 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-full text-xs font-semibold transition border border-white/5"
              >
                Kalibrasi Ulang
              </button>

              {onFinish && (
                <button
                  onClick={onFinish}
                  className="w-full sm:w-auto px-6 py-2.5 bg-white text-slate-950 hover:bg-slate-200 rounded-full text-xs sm:text-sm font-bold transition shadow-lg shadow-white/10 active:scale-95"
                >
                  Kembali ke Dashboard →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
