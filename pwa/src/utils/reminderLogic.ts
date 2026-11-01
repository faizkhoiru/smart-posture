/**
 * Logika murni untuk penanganan pengingat suara dan mute (testable tanpa Web Speech API).
 */

export interface ShouldTriggerReminderParams {
  lastRemindedAt: number | null; // Timestamp ms
  remindIntervalS: number; // Interval pengulangan (detik)
  isMuted: boolean;
  isAudioUnlocked: boolean;
  currentTime?: number; // Timestamp ms (default: Date.now())
}

export type TriggerDecision =
  | { shouldSpeak: true; reason: 'ready' }
  | { shouldSpeak: false; reason: 'muted' | 'interval_not_elapsed' | 'audio_locked' };

/**
 * Memeriksa apakah pengingat sedang dalam periode jeda (muted).
 */
export function isMuted(mutedUntil: string | null, currentTime: number = Date.now()): boolean {
  if (!mutedUntil) return false;
  try {
    const muteTime = new Date(mutedUntil).getTime();
    if (isNaN(muteTime)) return false;
    return muteTime > currentTime;
  } catch {
    return false;
  }
}

/**
 * Menghitung sisa waktu jeda dalam format teks "M menit S detik" atau null jika tidak aktif.
 */
export function formatMutedRemaining(mutedUntil: string | null, currentTime: number = Date.now()): string | null {
  if (!isMuted(mutedUntil, currentTime) || !mutedUntil) return null;

  const diffMs = new Date(mutedUntil).getTime() - currentTime;
  if (diffMs <= 0) return null;

  const totalSecs = Math.ceil(diffMs / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;

  if (mins > 0) {
    return `${mins} menit ${secs} detik`;
  }
  return `${secs} detik`;
}

/**
 * Memutuskan apakah pengingat suara boleh diputar saat ini.
 */
export function shouldTriggerReminder(params: ShouldTriggerReminderParams): TriggerDecision {
  const {
    lastRemindedAt,
    remindIntervalS,
    isMuted: muted,
    isAudioUnlocked,
    currentTime = Date.now()
  } = params;

  if (!isAudioUnlocked) {
    return { shouldSpeak: false, reason: 'audio_locked' };
  }

  if (muted) {
    return { shouldSpeak: false, reason: 'muted' };
  }

  if (lastRemindedAt === null) {
    return { shouldSpeak: true, reason: 'ready' };
  }

  const intervalMs = Math.max(remindIntervalS, 5) * 1000;
  const elapsed = currentTime - lastRemindedAt;

  if (elapsed >= intervalMs) {
    return { shouldSpeak: true, reason: 'ready' };
  }

  return { shouldSpeak: false, reason: 'interval_not_elapsed' };
}

