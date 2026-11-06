import "server-only";
import { SESSION_USER_SELECT, toSessionUser, type SessionUser } from "@/server/auth";
import { Prisma } from "@/generated/prisma/client";
import { getTodayAttempt } from "@/server/learning/lessons";
import { notify, type NotifyOutcome } from "@/server/notify";
import { prisma } from "@/server/db";
import { isCurrentProfile } from "@/domain/profile";
import { minutesOf, shiftDays, vnDate, vnMinuteOfDay, weekStartOf } from "@/lib/time";
import type { Lesson, Summary } from "@/domain/types";

/** The next lesson is chosen up to this long before the learner's study time. */
const PREPARE_LEAD_MIN = 60;
const REMIND_LEAD_MIN = 10;
/** After a cron outage, stale reminders are not sent hours late. */
const REMIND_LATE_MIN = 180;
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

export type StudyJobResult = { checked: number; prepared: number; reminders: Record<NotifyOutcome, number>; errors: number };

/** Prepares today's lesson before study time and sends the Zalo reminder. Safe to run every few minutes. */
export async function runStudyJobs(now = new Date()): Promise<StudyJobResult> {
  const today = vnDate(now);
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
    if (!isCurrentProfile(u.profile)) return false;
    const diff = minute - minutesOf(u.profile.study_time);
    return diff >= -PREPARE_LEAD_MIN && diff <= REMIND_LATE_MIN;
  });

  await inBatches(due, async (user) => {
    try {
      const attempt = await getTodayAttempt(user);
      if (attempt.localDate === today && !attempt.wordsDone && !attempt.practice) result.prepared++;
      const diff = minute - minutesOf(user.profile.study_time);
      if (!user.profile.reminders || diff < -REMIND_LEAD_MIN || attempt.completed || attempt.locked) return;
      const text = [
        `${firstName(user.name)} ơi, đến giờ học WeWIN Daily Speaking rồi!`,
        `Buổi ${attempt.day}/30: ${attempt.lesson.title}`,
        attempt.focus ? `Trọng tâm: ${attempt.focus}` : null,
        `Mở bài hôm nay (15 phút): ${appUrl()}/today`,
        `Trả lời "OK" để tiếp tục nhận nhắc học qua Zalo.`,
      ]
        .filter(Boolean)
        .join("\n");
      result.reminders[await notify(user.id, "study_reminder", today, text)]++;
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
