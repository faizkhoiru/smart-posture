import React, { useState, useEffect } from 'react';
import { useDeviceSocket } from './hooks/useDeviceSocket';
import { useVoiceReminder } from './hooks/useVoiceReminder';
import { apiClient } from './api/client';
import { Header } from './components/Header';
import { AlertBanner } from './components/AlertBanner';
import { ConsentModal, CONSENT_STORAGE_KEY } from './components/ConsentModal';
import { Navigation, TabId } from './components/Navigation';
import { DashboardPage } from './pages/DashboardPage';
import { CalibrationPage } from './pages/CalibrationPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import type { DeviceSummary } from './types/api';

const DEVICE_ID = import.meta.env.VITE_DEFAULT_DEVICE_ID || 'spc-001';

export default function App(): React.JSX.Element {
  const [currentTab, setCurrentTab] = useState<TabId>('dashboard');
  const [deviceInfo, setDeviceInfo] = useState<DeviceSummary | null>(null);

  // Dialog Persetujuan Pemantauan Sebelum Sesi Pertama
  const [isConsentOpen, setIsConsentOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(CONSENT_STORAGE_KEY) !== 'true';
    } catch {
      return true;
    }
  });

  // Hook WebSocket ke backend/mock
  const {
    status: connectionStatus,
    latestState,
    latestPose,
    activeAlert,
    reconnectCount,
    reconnect
  } = useDeviceSocket(DEVICE_ID, {
    onMessage: (msg) => {
      console.log('[WS Msg]', msg);
    },
    onAlert: (alert) => {
      console.warn('[WS Alert Diterima]', alert.message);
    },
    onAlertClear: () => {
      console.log('[WS Alert Cleared] Postur kembali normal.');
    }
  });

  // Hook Pengingat Suara Web Speech API (id-ID) dengan aturan autoplay & mute
  const {
    isAudioUnlocked,
    isSpeaking,
    unlockAudio,
    stopSpeaking
  } = useVoiceReminder({
    activeAlert,
    mutedUntil: latestState?.muted_until ?? null,
    remindIntervalS: activeAlert?.remind_interval_s ?? 60
  });

  // Ambil metadata perangkat dari REST API
  useEffect(() => {
    let isMounted = true;
    apiClient
      .getDevices()
      .then((devices) => {
        if (!isMounted) return;
        const current = devices.find((d) => d.id === DEVICE_ID) || devices[0];
        if (current) {
          setDeviceInfo(current);
        }
      })
      .catch((err) => {
        console.error('Gagal mengambil daftar perangkat:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleConsentAccept = () => {
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
    setIsConsentOpen(false);
  };

  const handleAckAlert = async (eventId: number) => {
    try {
      await apiClient.ackAlert(DEVICE_ID, { event_id: eventId });
      stopSpeaking();
      console.log('[Aksi] Alert diakui oleh pengguna (ACK):', eventId);
    } catch (err) {
      console.error('Gagal mengirim ACK alert:', err);
    }
  };

  const handleMuteAlert = async (minutes: number) => {
    try {
      await apiClient.muteAlert(DEVICE_ID, { minutes });
      stopSpeaking();
      console.log(`[Aksi] Alert dijeda selama ${minutes} menit`);
    } catch (err) {
      console.error('Gagal mengirim Mute alert:', err);
    }
  };

  const deviceName = deviceInfo?.name ?? 'Kursi Cerdas IoT';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Modal Persetujuan Pemantauan Awal (Privasi) */}
      <ConsentModal isOpen={isConsentOpen} onAccept={handleConsentAccept} />

      {/* Header Utama dengan Indikator Audio & Kamera */}
      <Header
        deviceName={deviceName}
        connectionStatus={connectionStatus}
        cameraState={latestState?.camera ?? 'off'}
        updatedAt={latestState?.updated_at}
        isAudioUnlocked={isAudioUnlocked}
        onUnlockAudio={unlockAudio}
      />

      {/* Banner Peringatan Offline / Putus / Sensor Error */}
      <AlertBanner
        connectionStatus={connectionStatus}
        deviceStatus={latestState?.device ?? deviceInfo?.status ?? 'online'}
        analysisStatus={latestState?.analysis ?? 'ok'}
        reconnectCount={reconnectCount}
        onRetryConnection={reconnect}
      />

      {/* Konten Halaman */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6">
        {currentTab === 'dashboard' && (
          <DashboardPage
            state={latestState}
            pose={latestPose}
            alert={activeAlert}
            isAudioUnlocked={isAudioUnlocked}
            isSpeaking={isSpeaking}
            onAckAlert={handleAckAlert}
            onMuteAlert={handleMuteAlert}
            onUnlockAudio={unlockAudio}
          />
        )}

        {currentTab === 'calibration' && (
          <CalibrationPage
            state={latestState}
            deviceId={DEVICE_ID}
            onFinish={() => setCurrentTab('dashboard')}
          />
        )}

        {currentTab === 'history' && (
          <HistoryPage deviceId={DEVICE_ID} />
        )}

        {currentTab === 'settings' && (
          <SettingsPage deviceId={DEVICE_ID} />
        )}
      </main>

      {/* Bottom Bar Navigation */}
      <Navigation currentTab={currentTab} onTabChange={setCurrentTab} />
    </div>
  );
}
