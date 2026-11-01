import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isMuted, formatMutedRemaining, shouldTriggerReminder } from './reminderLogic';

describe('reminderLogic utils', () => {
  const baseTime = 1700000000000; // Fixed timestamp

  describe('isMuted', () => {
    it('mengembalikan false bila mutedUntil null atau kosong', () => {
      assert.equal(isMuted(null, baseTime), false);
      assert.equal(isMuted('', baseTime), false);
    });

    it('mengembalikan true bila mutedUntil berada di masa depan', () => {
      const futureTime = new Date(baseTime + 5 * 60 * 1000).toISOString();
      assert.equal(isMuted(futureTime, baseTime), true);
    });

    it('mengembalikan false bila mutedUntil sudah lewat', () => {
      const pastTime = new Date(baseTime - 1000).toISOString();
      assert.equal(isMuted(pastTime, baseTime), false);
    });
  });

  describe('formatMutedRemaining', () => {
    it('mengembalikan null bila tidak sedang muted', () => {
      assert.equal(formatMutedRemaining(null, baseTime), null);
    });

    it('memformat menit dan detik dengan benar', () => {
      const fiveMins = new Date(baseTime + (4 * 60 + 30) * 1000).toISOString();
      assert.equal(formatMutedRemaining(fiveMins, baseTime), '4 menit 30 detik');
    });

    it('memformat detik saat kurang dari satu menit', () => {
      const fortySecs = new Date(baseTime + 40 * 1000).toISOString();
      assert.equal(formatMutedRemaining(fortySecs, baseTime), '40 detik');
    });
  });

  describe('shouldTriggerReminder', () => {
    it('menolak pengingat bila audio belum di-unlock oleh user (kebijakan autoplay)', () => {
      const decision = shouldTriggerReminder({
        lastRemindedAt: null,
        remindIntervalS: 60,
        isMuted: false,
        isAudioUnlocked: false,
        currentTime: baseTime
      });

      assert.equal(decision.shouldSpeak, false);
      assert.equal(decision.reason, 'audio_locked');
    });

    it('menolak pengingat bila sedang dalam status jeda (muted)', () => {
      const decision = shouldTriggerReminder({
        lastRemindedAt: null,
        remindIntervalS: 60,
        isMuted: true,
        isAudioUnlocked: true,
        currentTime: baseTime
      });

      assert.equal(decision.shouldSpeak, false);
      assert.equal(decision.reason, 'muted');
    });

    it('mengizinkan pengingat pertama saat audio unlocked dan tidak muted', () => {
      const decision = shouldTriggerReminder({
        lastRemindedAt: null,
        remindIntervalS: 60,
        isMuted: false,
        isAudioUnlocked: true,
        currentTime: baseTime
      });

      assert.equal(decision.shouldSpeak, true);
      assert.equal(decision.reason, 'ready');
    });

    it('menolak pengingat jika interval belum berlalu', () => {
      const decision = shouldTriggerReminder({
        lastRemindedAt: baseTime,
        remindIntervalS: 60,
        isMuted: false,
        isAudioUnlocked: true,
        currentTime: baseTime + 30 * 1000 // Baru berlalu 30 detik dari interval 60 detik
      });

      assert.equal(decision.shouldSpeak, false);
      assert.equal(decision.reason, 'interval_not_elapsed');
    });

    it('mengizinkan pengulangan pengingat setelah interval berlalu', () => {
      const decision = shouldTriggerReminder({
        lastRemindedAt: baseTime,
        remindIntervalS: 60,
        isMuted: false,
        isAudioUnlocked: true,
        currentTime: baseTime + 61 * 1000 // Sudah berlalu 61 detik
      });

      assert.equal(decision.shouldSpeak, true);
      assert.equal(decision.reason, 'ready');
    });
  });
});

