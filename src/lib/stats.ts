import { shiftDays, vnDate, vnWeekday } from "@/lib/time";
import type { HistoryItem } from "@/lib/types";

function doneDates(history: HistoryItem[]): Set<string> {
  return new Set(history.filter((h) => h.completed).map((h) => h.date));
}

/** Consecutive study days ending today, or yesterday if today is not done yet. */
export function streak(history: HistoryItem[]): number {
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

export function lastWeek(history: HistoryItem[]) {
  const done = doneDates(history);
  const today = vnDate();
  return Array.from({ length: 7 }, (_, i) => {
    const date = shiftDays(today, i - 6);
    return { label: vnWeekday(date), done: done.has(date), today: i === 6 };
  });
}

export function completedCount(history: HistoryItem[]): number {
  return history.filter((h) => h.completed).length;
}

export function totalTurns(history: HistoryItem[]): number {
  return history.reduce((n, h) => n + (h.summary?.turn_count ?? 0), 0);
}
