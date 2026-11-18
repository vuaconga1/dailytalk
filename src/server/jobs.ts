import "server-only";
import { SESSION_USER_SELECT, toSessionUser, type SessionUser } from "@/server/auth";
import { Prisma } from "@/generated/prisma/client";
import { getTodayAttempt } from "@/server/learning/lessons";
import { notify, type NotifyOutcome } from "@/server/notify";
import { prisma } from "@/server/db";
import { isCurrentProfile } from "@/domain/profile";
import { REMIND_LATE_MIN, REMIND_LEAD_MIN, scheduleStudyReminder, type ScheduleResult } from "@/server/integrations/qstash";
import { minutesOf, shiftDays, vnDate, vnMinuteOfDay, weekStartOf } from "@/lib/time";
import type { Lesson, Summary } from "@/domain/types";

const BATCH = 5;

export function appUrl(): string {
  return (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
}

async function inBatches<T>(items: T[], fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += BATCH) await Promise.all(items.slice(i, i + BATCH).map(fn));
}

function firstName(name: string): string {
  return name.trim().split(/\s+/).at(-1) ?? name;
}

export async function expireAccounts(now = new Date()): Promise<number> {
  const { count } = await prisma.user.updateMany({
    where: { status: { in: ["ACTIVE", "LEAD"] }, OR: [{ accessEndsAt: { lt: now }, status: "ACTIVE" }, { lockAt: { lte: now } }] },
    data: { status: "EXPIRED" },
  });
  return count;
}

function isReminderLearner(user: SessionUser): user is SessionUser & { profile: NonNullable<SessionUser["profile"]> } {
  return (
    user.role === "LEARNER" &&
    !user.isDemo &&
    (user.status === "ACTIVE" || user.status === "LEAD") &&
    Boolean(user.plan) &&
    isCurrentProfile(user.profile) &&
    user.profile.reminders === true
  );
}

export type StudyReminderResult = {
  outcome: "sent" | "skipped" | "failed" | "duplicate" | "ignored";
  reason?: string;
  scheduled?: ScheduleResult;
};

/**
 * Prepares today's lesson (if needed) and sends the email/Zalo reminder for one learner.
 * Always tries to enqueue the next QStash slot when reminders stay on.
 */
export async function runStudyReminderForUser(
  userId: string,
  now = new Date(),
  expectedStudyTime?: string,
): Promise<StudyReminderResult> {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: SESSION_USER_SELECT });
  if (!row) return { outcome: "ignored", reason: "Không tìm thấy học viên" };
  const user = toSessionUser(row);
  if (!isReminderLearner(user)) {
    return { outcome: "ignored", reason: "Không đủ điều kiện nhắc học" };
  }

  if (expectedStudyTime && expectedStudyTime !== user.profile.study_time) {
    const scheduled = await scheduleStudyReminder(user.id, user.profile.study_time, now);
    return { outcome: "ignored", reason: "Giờ học đã đổi — xếp lại lịch", scheduled };
  }

  const today = vnDate(now);
  const diff = vnMinuteOfDay(now) - minutesOf(user.profile.study_time);

  if (diff < -REMIND_LEAD_MIN) {
    const scheduled = await scheduleStudyReminder(user.id, user.profile.study_time, now);
    return { outcome: "ignored", reason: "Chưa tới giờ nhắc", scheduled };
  }
  if (diff > REMIND_LATE_MIN) {
    const scheduled = await scheduleStudyReminder(user.id, user.profile.study_time, now);
    return { outcome: "ignored", reason: "Quá muộn so với giờ học", scheduled };
  }

  try {
    const attempt = await getTodayAttempt(user);
    if (attempt.completed || attempt.locked) {
      const scheduled = await scheduleStudyReminder(user.id, user.profile.study_time, now);
      return { outcome: "skipped", reason: attempt.locked ? "Buổi bị khóa" : "Đã học xong hôm nay", scheduled };
    }

    const todayUrl = `${appUrl()}/today`;
    const intro = [
      `${firstName(user.name)} ơi, đến giờ học WeWIN Daily Speaking rồi!`,
      `Buổi ${attempt.day}/30: ${attempt.lesson.title}`,
      attempt.focus ? `Trọng tâm: ${attempt.focus}` : null,
      `Mở bài hôm nay (15 phút): ${todayUrl}`,
    ].filter(Boolean);
    const zaloText = [...intro, `Trả lời "OK" để tiếp tục nhận nhắc học qua Zalo.`].join("\n");
    const emailText = intro.join("\n");
    const outcome = await notify(user.id, "study_reminder", today, zaloText, {
      emailSubject: `Đến giờ học · Buổi ${attempt.day}/30`,
      emailText,
      emailCtaUrl: todayUrl,
    });

    // After today's attempt, push "now" slightly past the late window so the next slot is tomorrow.
    const afterToday = new Date(now.getTime() + (REMIND_LATE_MIN + 1) * 60_000);
    const scheduled = await scheduleStudyReminder(user.id, user.profile.study_time, afterToday);
    return { outcome, scheduled };
  } catch (error) {
    console.error("study reminder", userId, error);
    const scheduled = await scheduleStudyReminder(user.id, user.profile.study_time, now).catch(() => undefined);
    return { outcome: "failed", reason: String(error).slice(0, 300), scheduled };
  }
}

/**
 * Enqueue the next reminder for a learner after profile/activation changes.
 * Safe to call when QStash is not configured (dry-run log).
 */
export async function enqueueStudyReminder(userId: string): Promise<ScheduleResult | { ok: false; skipped: true; reason: string }> {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: SESSION_USER_SELECT });
  if (!row) return { ok: false, skipped: true, reason: "Không tìm thấy học viên" };
  const user = toSessionUser(row);
  if (!isReminderLearner(user)) return { ok: false, skipped: true, reason: "Không đủ điều kiện nhắc học" };
  return scheduleStudyReminder(user.id, user.profile.study_time);
}

export type EnsureSchedulesResult = { checked: number; scheduled: number; skipped: number; failed: number };

/** Daily safety net: ensure every eligible learner has a QStash reminder queued. Deduped per day. */
export async function ensureStudySchedules(): Promise<EnsureSchedulesResult> {
  const rows = await prisma.user.findMany({
    where: { role: "LEARNER", isDemo: false, status: { in: ["ACTIVE", "LEAD"] }, plan: { not: Prisma.DbNull } },
    select: SESSION_USER_SELECT,
  });
  const result: EnsureSchedulesResult = { checked: 0, scheduled: 0, skipped: 0, failed: 0 };
  const due = rows.map(toSessionUser).filter(isReminderLearner);
  result.checked = due.length;

  await inBatches(due, async (user) => {
    const scheduled = await scheduleStudyReminder(user.id, user.profile.study_time);
    if (scheduled.ok) result.scheduled++;
    else if (scheduled.skipped) result.skipped++;
    else result.failed++;
  });
  return result;
}

export type StudyJobResult = { checked: number; prepared: number; reminders: Record<NotifyOutcome, number>; errors: number };

/**
 * Manual / fallback sweep (admin "Chạy ngay" or ?jobs=study).
 * Production reminders should come from QStash per learner, not this loop.
 */
export async function runStudyJobs(now = new Date()): Promise<StudyJobResult> {
  const minute = vnMinuteOfDay(now);
  const rows = await prisma.user.findMany({
    where: { role: "LEARNER", isDemo: false, status: { in: ["ACTIVE", "LEAD"] }, plan: { not: Prisma.DbNull } },
    select: SESSION_USER_SELECT,
  });
  const result: StudyJobResult = {
    checked: rows.length,
    prepared: 0,
    reminders: { sent: 0, skipped: 0, failed: 0, duplicate: 0 },
    errors: 0,
  };

  const due = rows.map(toSessionUser).filter((u): u is SessionUser & { profile: NonNullable<SessionUser["profile"]> } => {
    if (!isReminderLearner(u)) return false;
    const diff = minute - minutesOf(u.profile.study_time);
    return diff >= -REMIND_LEAD_MIN && diff <= REMIND_LATE_MIN;
  });

  await inBatches(due, async (user) => {
    try {
      const attempt = await getTodayAttempt(user);
      if (attempt.localDate === vnDate(now) && !attempt.wordsDone && !attempt.practice) result.prepared++;
      const out = await runStudyReminderForUser(user.id, now);
      if (out.outcome === "sent" || out.outcome === "skipped" || out.outcome === "failed" || out.outcome === "duplicate") {
        result.reminders[out.outcome]++;
      }
    } catch (error) {
      result.errors++;
      console.error("study job", user.id, error);
    }
  });
  return result;
}

type Counted = [label: string, count: number][];

function topCounts(values: string[], limit: number): Counted {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

export type WeeklyHighlights = { errors: Counted; reviewItems: Counted; notAchieved: string[] };

/** Builds the Monday→Sunday report of `weekStart` for every learner who studied or was active. */
export async function buildWeeklyReports(weekStart: string): Promise<number> {
  const weekEnd = shiftDays(weekStart, 6);
  const learners = await prisma.user.findMany({
    where: {
      role: "LEARNER",
      isDemo: false,
      weeklyReports: { none: { weekStart } },
      OR: [{ status: "ACTIVE" }, { attempts: { some: { localDate: { gte: weekStart, lte: weekEnd } } } }],
    },
    select: { id: true },
  });
  let created = 0;
  await inBatches(learners, async ({ id }) => {
    const attempts = await prisma.attempt.findMany({
      where: { userId: id, completed: true, localDate: { gte: weekStart, lte: weekEnd } },
      select: { localDate: true, lesson: true, summary: true },
    });
    const summaries = attempts.map((a) => a.summary as Summary | null);
    const sessionsDone = attempts.length;
    const achieved = summaries.filter((s) => s?.goal_status === "achieved").length;
    const highlights: WeeklyHighlights = {
      errors: topCounts(summaries.flatMap((s) => (s?.errors ?? []).map((e) => e.issue)), 3),
      reviewItems: topCounts(summaries.flatMap((s) => s?.review_items ?? []), 5),
      notAchieved: attempts.filter((a, i) => summaries[i]?.goal_status !== "achieved").map((a) => (a.lesson as Lesson).title),
    };
    const reasons = [
      sessionsDone < 3 ? `Chỉ học ${sessionsDone}/7 ngày` : null,
      sessionsDone > 0 && achieved / sessionsDone < 0.5 ? `Chỉ ${achieved}/${sessionsDone} buổi đạt mục tiêu` : null,
      highlights.errors[0]?.[1] >= 3 ? `Lỗi lặp lại: ${highlights.errors[0][0]}` : null,
    ].filter((r): r is string => r !== null);
    const { count } = await prisma.weeklyReport.createMany({
      data: [
        {
          userId: id,
          weekStart,
          sessionsDone,
          activeDays: new Set(attempts.map((a) => a.localDate)).size,
          voiceTurns: summaries.reduce((n, s) => n + (s?.voice_turns ?? 0), 0),
          achieved,
          highlights: highlights as unknown as Prisma.InputJsonValue,
          needsSupport: reasons.length > 0,
          supportNote: reasons.join(" · ") || null,
        },
      ],
      skipDuplicates: true,
    });
    created += count;
  });
  return created;
}

/** The last fully finished week (Monday). */
export function lastWeekStart(now = new Date()): string {
  return shiftDays(weekStartOf(vnDate(now)), -7);
}
