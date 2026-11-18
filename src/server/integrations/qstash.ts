import "server-only";
import { Client, Receiver } from "@upstash/qstash";
import { minutesOf, shiftDays, vnDate, vnInstant, vnMinuteOfDay } from "@/lib/time";

function appUrl(): string {
  return (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
}

/** Reminder fires this many minutes before the learner's study_time. */
export const REMIND_LEAD_MIN = 10;
/** Do not send if more than this late past study_time (stale queue). */
export const REMIND_LATE_MIN = 180;

const env = (name: string) => process.env[name]?.trim() || "";

export function qstashConfigured(): boolean {
  return Boolean(env("QSTASH_TOKEN") && env("QSTASH_CURRENT_SIGNING_KEY") && env("QSTASH_NEXT_SIGNING_KEY"));
}

function client(): Client | null {
  const token = env("QSTASH_TOKEN");
  if (!token) return null;
  // Upstash tokens are base64; a missing trailing "=" (easy when pasting) causes 401.
  const normalized = token.length % 4 === 0 ? token : token.padEnd(token.length + ((4 - (token.length % 4)) % 4), "=");
  const baseUrl = env("QSTASH_URL") || undefined;
  return new Client({ token: normalized, ...(baseUrl ? { baseUrl } : {}) });
}

export function qstashReceiver(): Receiver | null {
  const currentSigningKey = env("QSTASH_CURRENT_SIGNING_KEY");
  const nextSigningKey = env("QSTASH_NEXT_SIGNING_KEY");
  if (!currentSigningKey || !nextSigningKey) return null;
  return new Receiver({ currentSigningKey, nextSigningKey });
}

export type ReminderSlot = {
  /** Vietnam calendar day of the study session being reminded. */
  localDate: string;
  /** When QStash should deliver the callback. */
  notBefore: Date;
};

/**
 * Next reminder delivery for `studyTime` (HH:MM, Vietnam).
 * Prefer an in-window "send soon" slot when the learner is already in the remind/late window.
 */
export function nextReminderSlot(studyTime: string, now = new Date()): ReminderSlot {
  const studyMin = minutesOf(studyTime);
  const today = vnDate(now);
  const minute = vnMinuteOfDay(now);
  const diff = minute - studyMin;

  if (diff >= -REMIND_LEAD_MIN && diff <= REMIND_LATE_MIN) {
    return { localDate: today, notBefore: now };
  }

  const remindMin = studyMin - REMIND_LEAD_MIN;
  const slotFor = (localDate: string): ReminderSlot => {
    if (remindMin >= 0) return { localDate, notBefore: vnInstant(localDate, remindMin) };
    return { localDate, notBefore: vnInstant(shiftDays(localDate, -1), remindMin + 24 * 60) };
  };

  const todaySlot = slotFor(today);
  if (todaySlot.notBefore.getTime() > Date.now() + 15_000) return todaySlot;
  return slotFor(shiftDays(today, 1));
}

export type ScheduleResult =
  | { ok: true; messageId: string; localDate: string; notBefore: string }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped?: false; reason: string };

function studyReminderUrl(): string {
  return `${appUrl()}/api/qstash/study-reminder`;
}

/**
 * Enqueues one QStash callback for the learner's next reminder slot.
 * Deduped per (user, localDate) so ensure/cron backfills are cheap.
 * No-op dry-run when QStash env is missing.
 */
export async function scheduleStudyReminder(userId: string, studyTime: string, now = new Date()): Promise<ScheduleResult> {
  const slot = nextReminderSlot(studyTime, now);
  const notBeforeSec = Math.floor(slot.notBefore.getTime() / 1000);
  const dedupeId = `study-reminder:${userId}:${slot.localDate}`;

  const q = client();
  if (!q) {
    const reason = "QStash dry-run (thiếu QSTASH_TOKEN)";
    console.info("[qstash]", reason, { userId, localDate: slot.localDate, notBefore: slot.notBefore.toISOString() });
    return { ok: false, skipped: true, reason };
  }

  try {
    const res = await q.publishJSON({
      url: studyReminderUrl(),
      body: { userId, localDate: slot.localDate, studyTime },
      notBefore: notBeforeSec,
      deduplicationId: `${dedupeId}:${studyTime}`,
      retries: 3,
    });
    return {
      ok: true,
      messageId: res.messageId,
      localDate: slot.localDate,
      notBefore: slot.notBefore.toISOString(),
    };
  } catch (error) {
    const message = String(error);
    // Duplicate within the dedupe window is success for our purposes.
    if (/dedup|already|conflict/i.test(message)) {
      return { ok: false, skipped: true, reason: `Đã lên lịch (${slot.localDate})` };
    }
    return { ok: false, reason: message.slice(0, 300) };
  }
}
