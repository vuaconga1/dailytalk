import type { GoalStatus, Lesson, Summary, WeekReview } from "@/lib/types";

export const WEEK_DAYS = 7;
const LAST_DAY = 30;

/** Study week of a roadmap day: days 1–7 are week 1, …, days 29–30 are week 5. */
export function weekOf(day: number): {
  week: number;
  fromDay: number;
  toDay: number;
} {
  const week = Math.ceil(day / WEEK_DAYS);
  const fromDay = (week - 1) * WEEK_DAYS + 1;
  return { week, fromDay, toDay: Math.min(week * WEEK_DAYS, LAST_DAY) };
}

type Row = {
  day: number;
  lesson: Lesson;
  summary: Summary | null;
  completed: boolean;
};

/** Weekly review built from the week's study days (any order). */
export function buildWeekReview(week: number, rows: Row[]): WeekReview {
  const { fromDay, toDay } = weekOf((week - 1) * WEEK_DAYS + 1);
  const inWeek = rows.filter((r) => r.day >= fromDay && r.day <= toDay).sort((a, b) => a.day - b.day);
  const done = inWeek.filter((r) => r.completed);

  const words = new Map<string, WeekReview["words"][number]>();
  const frames: WeekReview["frames"] = [];
  const errors = new Map<string, { issue: string; count: number; correction: string }>();
  const review = new Set<string>();
  for (const r of done) {
    const usedFrames = r.summary?.frames_used ?? [];
    if (r.lesson.recap) {
      for (const [i, f] of r.lesson.frames.entries()) {
        const earlier = frames.find((x) => x.frame === f);
        if (earlier) earlier.used ||= usedFrames.includes(f);
        else frames.push({ frame: f, day: r.lesson.recap.frameDays[i] ?? r.day, used: usedFrames.includes(f) });
      }
      continue;
    }
    for (const v of r.lesson.vocabulary)
      if (!words.has(v.word.toLowerCase())) words.set(v.word.toLowerCase(), { word: v.word, meaning: v.meaning });
    for (const f of r.lesson.frames) frames.push({ frame: f, day: r.day, used: usedFrames.includes(f) });
    for (const e of r.summary?.errors ?? []) {
      const key = e.issue.toLowerCase();
      const hit = errors.get(key);
      if (hit) hit.count++;
      else errors.set(key, { issue: e.issue, count: 1, correction: e.correction });
    }
    for (const item of r.summary?.review_items ?? []) review.add(item);
  }

  return {
    week,
    fromDay,
    toDay,
    total: toDay - fromDay + 1,
    done: done.length,
    achieved: done.filter((r) => r.summary?.goal_status === "achieved").length,
    turns: done.reduce((n, r) => n + (r.summary?.turn_count ?? 0), 0),
    voiceTurns: done.reduce((n, r) => n + (r.summary?.voice_turns ?? 0), 0),
    days: inWeek.map((r) => ({
      day: r.day,
      title: r.lesson.title,
      status: r.completed ? ((r.summary?.goal_status ?? "insufficient_evidence") as GoalStatus) : null,
    })),
    words: [...words.values()],
    frames,
    errors: [...errors.values()].sort((a, b) => b.count - a.count).slice(0, 3),
    review: [...review].slice(0, 8),
  };
}
