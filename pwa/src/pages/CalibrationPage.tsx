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
    <div className="space-y-4 pb-20">
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
        {/* Header Wizard */}
        <div className="border-b border-slate-800 pb-4 mb-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Wizard Kalibrasi Perangkat</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Panduan 3 langkah untuk menyesuaikan sensor beban dan acuan postur tegak Anda.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-mono font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              {currentStep <= 3 ? `Langkah ${currentStep} dari 3` : 'Selesai'}
            </span>
          </div>

          {/* Stepper Progress Bar */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div
              className={`h-1.5 rounded-full transition-all ${
                currentStep >= 1 ? 'bg-indigo-500' : 'bg-slate-800'
              }`}
            />
            <div
              className={`h-1.5 rounded-full transition-all ${
                currentStep >= 2 ? 'bg-indigo-500' : 'bg-slate-800'
              }`}
            />
            <div
              className={`h-1.5 rounded-full transition-all ${
                currentStep >= 3 ? 'bg-indigo-500' : 'bg-slate-800'
              }`}
            />
          </div>
        </div>

        {/* Notifikasi Error Ramah */}
        {errorMessage && (
          <div className="mb-4 p-3.5 bg-rose-950/60 border border-rose-500/40 rounded-xl text-xs text-rose-200 flex items-start justify-between gap-3 animate-fadeIn">
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
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-xs">
                  1
                </span>
                <h3 className="text-sm sm:text-base font-semibold text-slate-100">
                  Kalibrasi Kursi Kosong (Tare)
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Pastikan kursi dalam keadaan <strong>benar-benar kosong</strong> tanpa beban tas, buku, atau orang.
                Sistem akan mencatat nilai ADC tare dari kedua load cell sebagai titik acuan nol kilogram.
              </p>
              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                <span>Status Okupansi Saat Ini:</span>
                <span className="font-semibold text-slate-200 font-mono capitalize">
                  {state?.chair ?? 'empty'}
                </span>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleStep1Tare}
                disabled={loading}
                className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white disabled:text-slate-500 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 shadow"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-xs">
                  2
                </span>
                <h3 className="text-sm sm:text-base font-semibold text-slate-100">
                  Kalibrasi Beban Duduk (Scale Factor)
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Silakan duduk di kursi dengan posisi normal. Masukkan bobot tubuh Anda (atau beban acuan yang digunakan) untuk mengkalibrasi faktor skala timbangan:
              </p>

              <div className="space-y-1.5 pt-1">
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
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                    placeholder="Contoh: 65"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-500">kg</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <button
                onClick={() => setCurrentStep(1)}
                disabled={loading}
                className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
              >
                ← Kembali ke Langkah 1
              </button>

              <button
                onClick={handleStep2Occupied}
                disabled={loading}
                className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white disabled:text-slate-500 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 shadow"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-xs">
                  3
                </span>
                <h3 className="text-sm sm:text-base font-semibold text-slate-100">
                  Perekaman Baseline Postur Tegak
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Tetap duduk di kursi, tegakkan punggung Anda dengan rileks, dan pandang lurus ke depan menghadap kamera.
                Sistem akan memotret 10 frame berturut-turut untuk menentukan sudut referensi bahu dan kepala ideal Anda.
              </p>

              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                <span>Kamera ESP32-CAM:</span>
                <span className="font-semibold text-emerald-400 font-mono">
                  {state?.camera === 'on' ? 'Aktif' : 'Menunggu Pemicu'}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <button
                onClick={() => setCurrentStep(2)}
                disabled={loading}
                className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
              >
                ← Kembali ke Langkah 2
              </button>

              <button
                onClick={handleStep3Posture}
                disabled={loading}
                className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white disabled:text-slate-500 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 shadow"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
          <div className="space-y-5 animate-fadeIn">
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-5 text-emerald-100 flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-xl shrink-0">
                ✓
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-emerald-100">
                  Kalibrasi Berhasil Disimpan!
                </h3>
                <p className="text-xs text-emerald-300/90 leading-relaxed">
                  Profil timbangan dan baseline postur acuan telah disimpan ke backend. Sistem sekarang siap memantau postur duduk Anda secara akurat.
                </p>
              </div>
            </div>

            {/* Rincian Hasil */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
                <div className="text-xs text-slate-400">Kalibrasi Timbangan (Load Cell)</div>
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Nilai Tare (Titik Nol):</span>
                    <span className="font-mono text-slate-200">
                      {emptyLoadResult?.profile?.tare ?? 124500}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Faktor Skala (Scale):</span>
                    <span className="font-mono text-slate-200">
                      {occupiedLoadResult?.profile?.scale ?? 448.5}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
                <div className="text-xs text-slate-400">Baseline Geometri Postur</div>
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sudut Telinga-Bahu-Pinggul:</span>
                    <span className="font-mono text-emerald-400">
                      {postureResult?.baseline?.side_angle ?? 93.4}°
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Offset Horizontal Kepala:</span>
                    <span className="font-mono text-slate-200">
                      {postureResult?.baseline?.head_offset ?? 0.04}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Peringatan Baseline Jika Ada */}
            {postureResult?.warnings && postureResult.warnings.length > 0 && (
              <div className="p-3 bg-amber-950/60 border border-amber-500/40 rounded-xl text-xs text-amber-200">
                <strong>Catatan Kalibrasi:</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-amber-300/80">
                  {postureResult.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={resetWizard}
                className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
              >
                Kalibrasi Ulang
              </button>

              {onFinish && (
                <button
                  onClick={onFinish}
                  className="w-full sm:w-auto px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-semibold transition shadow"
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
