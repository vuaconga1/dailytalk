import { shiftDays, vnDate, vnWeekday } from "@/lib/time";
import type { HistoryItem } from "@/domain/types";

/** Minimal row for streak / calendar helpers (full HistoryItem also works). */
export type StatsDay = Pick<HistoryItem, "date" | "completed">;
export type StatsSummaryRow = StatsDay & Pick<HistoryItem, "summary">;

function doneDates(history: StatsDay[]): Set<string> {
  return new Set(history.filter((h) => h.completed).map((h) => h.date));
}

/** Consecutive study days ending today, or yesterday if today is not done yet. */
export function streak(history: StatsDay[]): number {
  const done = doneDates(history);
  let day = vnDate();
  if (!done.has(day)) day = shiftDays(day, -1);
  let n = 0;
  while (done.has(day)) {
    n++;
    day = shiftDays(day, -1);
  }
  return n;
}

export function lastWeek(history: StatsDay[]) {
  const done = doneDates(history);
  const today = vnDate();
  return Array.from({ length: 7 }, (_, i) => {
    const date = shiftDays(today, i - 6);
    return { label: vnWeekday(date), done: done.has(date), today: i === 6 };
  });
}

export function completedCount(history: StatsDay[]): number {
  return history.filter((h) => h.completed).length;
}

export function totalTurns(history: StatsSummaryRow[]): number {
  return history.reduce((n, h) => n + (h.summary?.turn_count ?? 0), 0);
}
