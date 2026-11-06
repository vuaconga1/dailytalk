import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { normalizeLesson } from "@/domain/content";
import type { HistoryItem, Summary, WeekReview } from "@/domain/types";
import { buildWeekReview, weekOf } from "@/domain/week";
import { prisma } from "@/server/db";

export async function getHistory(userId: string): Promise<HistoryItem[]> {
  const rows = await prisma.attempt.findMany({
    where: { userId },
    orderBy: { day: "desc" },
    select: {
      day: true,
      localDate: true,
      lesson: true,
      summary: true,
      completed: true,
    },
  });
  return rows.map((r) => {
    const l = normalizeLesson(r.lesson);
    return {
      day: r.day,
      date: r.localDate,
      title: l.title,
      situation: l.situation,
      level: l.level,
      goal: l.goal,
      completed: r.completed,
      summary: r.summary as Summary | null,
    };
  });
}

async function weekRows(where: Prisma.AttemptWhereInput) {
  const rows = await prisma.attempt.findMany({
    where,
    select: { day: true, lesson: true, summary: true, completed: true },
  });
  return rows.map((r) => ({
    ...r,
    lesson: normalizeLesson(r.lesson),
    summary: r.summary as Summary | null,
  }));
}

/** Reviews of every study week the learner has started, latest first. */
export async function getWeekReviews(userId: string): Promise<WeekReview[]> {
  const rows = await weekRows({ userId });
  const weeks = [...new Set(rows.map((r) => weekOf(r.day).week))].sort((a, b) => b - a);
  return weeks.map((w) => buildWeekReview(w, rows));
}

/** Review of the study week that contains `day`. */
export async function getWeekReview(userId: string, day: number): Promise<WeekReview> {
  const { week, fromDay, toDay } = weekOf(day);
  return buildWeekReview(week, await weekRows({ userId, day: { gte: fromDay, lte: toDay } }));
}
