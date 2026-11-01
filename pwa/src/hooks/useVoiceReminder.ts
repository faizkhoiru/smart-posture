import { useState, useEffect, useRef, useCallback } from 'react';
import type { WsAlertMessage } from '../types/ws';
import { isMuted, shouldTriggerReminder } from '../utils/reminderLogic';

const AUDIO_STORAGE_KEY = 'spc_audio_unlocked';

export interface UseVoiceReminderProps {
  activeAlert: WsAlertMessage | null;
  mutedUntil: string | null;
  remindIntervalS?: number;
}

export interface UseVoiceReminderReturn {
  isAudioUnlocked: boolean;
  isSpeaking: boolean;
  audioSupported: boolean;
  unlockAudio: () => void;
  toggleAudio: () => void;
  stopSpeaking: () => void;
  speakText: (text: string) => void;
}

export function useVoiceReminder({
  activeAlert,
  mutedUntil,
  remindIntervalS = 60
}: UseVoiceReminderProps): UseVoiceReminderReturn {
  const [isAudioUnlocked, setIsAudioUnlocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem(AUDIO_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const lastRemindedAtRef = useRef<number | null>(null);

  const audioSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const stopSpeaking = useCallback(() => {
    if (audioSupported) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [audioSupported]);

  const speakText = useCallback(
    (text: string) => {
      if (!audioSupported || !text) return;

      // Hentikan suara yang sedang berjalan sebelumnya
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.rate = 0.95; // Sedikit lebih lambat agar ramah dan artikulatif
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setIsSpeaking(true);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
      };

      utterance.onerror = (e) => {
        console.warn('[useVoiceReminder] Galat pemutaran suara:', e);
        setIsSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);
      lastRemindedAtRef.current = Date.now();
    },
    [audioSupported]
  );

  // Membuka blokir autoplay melalui interaksi eksplisit pengguna
  const unlockAudio = useCallback(() => {
    if (!audioSupported) return;

    try {
      localStorage.setItem(AUDIO_STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
    setIsAudioUnlocked(true);

    // Mainkan konfirmasi singkat berbahasa Indonesia
    speakText('Suara pengingat postur telah aktif.');
  }, [audioSupported, speakText]);

  const toggleAudio = useCallback(() => {
    if (!isAudioUnlocked) {
      unlockAudio();
    } else {
      stopSpeaking();
      setIsAudioUnlocked(false);
      try {
        localStorage.setItem(AUDIO_STORAGE_KEY, 'false');
      } catch {
        // ignore
      }
    }
  }, [isAudioUnlocked, unlockAudio, stopSpeaking]);

  // Efek loop pengingat suara saat ada alert aktif
  useEffect(() => {
    // Bila tidak ada alert aktif atau kondisi muted aktif, hentikan suara seketika
    if (!activeAlert || isMuted(mutedUntil)) {
      stopSpeaking();
      lastRemindedAtRef.current = null;
      return;
    }

    const intervalS = activeAlert.remind_interval_s || remindIntervalS || 60;

    // Evaluasi apakah pengingat harus dibunyikan sekarang
    const evaluateAndSpeak = () => {
      const decision = shouldTriggerReminder({
        lastRemindedAt: lastRemindedAtRef.current,
        remindIntervalS: intervalS,
        isMuted: isMuted(mutedUntil),
        isAudioUnlocked,
        currentTime: Date.now()
      });

      if (decision.shouldSpeak) {
        speakText(activeAlert.message);
      }
    };

    // Jalankan segera saat alert pertama kali muncul
    evaluateAndSpeak();

    // Loop interval pemeriksaan berkala
    const timer = setInterval(() => {
      evaluateAndSpeak();
    }, 2000);

    return () => {
      clearInterval(timer);
    };
  }, [activeAlert, mutedUntil, remindIntervalS, isAudioUnlocked, speakText, stopSpeaking]);

  return {
    isAudioUnlocked,
    isSpeaking,
    audioSupported,
    unlockAudio,
    toggleAudio,
    stopSpeaking,
    speakText
  };
}

