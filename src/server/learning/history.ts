import "server-only";
import { cache } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { normalizeLesson } from "@/domain/content";
import type { HistoryItem, Summary, WeekReview } from "@/domain/types";
import { streak } from "@/domain/stats";
import { buildWeekReview, weekOf } from "@/domain/week";
import { prisma } from "@/server/db";

type AttemptHistoryRow = {
  day: number;
  localDate: string;
  lesson: unknown;
  summary: unknown;
  completed: boolean;
};

function toHistoryItem(r: AttemptHistoryRow): HistoryItem {
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
}

function toWeekRow(r: { day: number; lesson: unknown; summary: unknown; completed: boolean }) {
  return {
    day: r.day,
    lesson: normalizeLesson(r.lesson),
    summary: r.summary as Summary | null,
    completed: r.completed,
  };
}

/** Lean completed dates for the header streak badge (no lesson/summary JSON). */
export const getStreakDays = cache(async (userId: string): Promise<number> => {
  const rows = await prisma.attempt.findMany({
    where: { userId, completed: true },
    select: { localDate: true },
  });
  return streak(rows.map((r) => ({ date: r.localDate, completed: true as const })));
});

/** Today dashboard stats: dates + summaries only (no lesson blobs). */
export const getTodayStatsHistory = cache(async (userId: string): Promise<HistoryItem[]> => {
  const rows = await prisma.attempt.findMany({
    where: { userId },
    orderBy: { day: "desc" },
    select: {
      day: true,
      localDate: true,
      summary: true,
      completed: true,
    },
  });
  return rows.map((r) => ({
    day: r.day,
    date: r.localDate,
    title: "",
    completed: r.completed,
    summary: r.summary as Summary | null,
  }));
});

/** Plan roadmap: day + title + completed (no summary JSON). */
export const getPlanHistory = cache(async (userId: string): Promise<Pick<HistoryItem, "day" | "title" | "completed">[]> => {
  const rows = await prisma.attempt.findMany({
    where: { userId },
    orderBy: { day: "desc" },
    select: {
      day: true,
      lesson: true,
      completed: true,
    },
  });
  return rows.map((r) => ({
    day: r.day,
    title: normalizeLesson(r.lesson).title,
    completed: r.completed,
  }));
});

const HISTORY_SELECT = {
  day: true,
  localDate: true,
  lesson: true,
  summary: true,
  completed: true,
} satisfies Prisma.AttemptSelect;

const loadFullHistoryRows = cache(async (userId: string): Promise<AttemptHistoryRow[]> => {
  return prisma.attempt.findMany({
    where: { userId },
    orderBy: { day: "desc" },
    select: HISTORY_SELECT,
  });
});

export const getHistory = cache(async (userId: string): Promise<HistoryItem[]> => {
  const rows = await loadFullHistoryRows(userId);
  return rows.map(toHistoryItem);
});

async function weekRows(where: Prisma.AttemptWhereInput) {
  const rows = await prisma.attempt.findMany({
    where,
    select: { day: true, lesson: true, summary: true, completed: true },
  });
  return rows.map(toWeekRow);
}

/** Reviews of every study week the learner has started, latest first. */
export const getWeekReviews = cache(async (userId: string): Promise<WeekReview[]> => {
  const rows = (await loadFullHistoryRows(userId)).map(toWeekRow);
  const weeks = [...new Set(rows.map((r) => weekOf(r.day).week))].sort((a, b) => b - a);
  return weeks.map((w) => buildWeekReview(w, rows));
});

/** History page: one DB round-trip for list + week reviews. */
export const getHistoryPageData = cache(async (userId: string): Promise<{ history: HistoryItem[]; weekReviews: WeekReview[] }> => {
  const raw = await loadFullHistoryRows(userId);
  const history = raw.map(toHistoryItem);
  const weekRowsMapped = raw.map(toWeekRow);
  const weeks = [...new Set(weekRowsMapped.map((r) => weekOf(r.day).week))].sort((a, b) => b - a);
  return {
    history,
    weekReviews: weeks.map((w) => buildWeekReview(w, weekRowsMapped)),
  };
});

/** Review of the study week that contains `day`. */
export async function getWeekReview(userId: string, day: number): Promise<WeekReview> {
  const { week, fromDay, toDay } = weekOf(day);
  return buildWeekReview(week, await weekRows({ userId, day: { gte: fromDay, lte: toDay } }));
}
