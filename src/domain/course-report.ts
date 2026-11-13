import { LAST_STUDY_DAY } from "@/domain/access";
import { WEEK_DAYS } from "@/domain/week";
import { shiftDays } from "@/lib/time";
import type { Lesson, LevelId, StudyPlan, Summary } from "@/domain/types";

export type CourseReport = {
  /** Study days in the learner's course. */
  totalDays: number;
  completed: number;
  firstDate: string;
  lastDate: string;
  /** Calendar days from the first to the last completed session. */
  spanDays: number;
  studySeconds: number;
  /** Calendar days with tracked study time. */
  studyDays: number;
  achieved: number;
  needsReview: number;
  achievementRate: number;
  words: number;
  frames: number;
  /** Learned frames the learner actually said in a conversation. */
  framesUsed: number;
  situations: number;
  reviewDays: number;
  turns: number;
  voiceTurns: number;
  longestStreak: number;
  errors: number;
  topErrors: { issue: string; count: number; correction: string }[];
  reviewItems: number;
  startLevel: LevelId;
  endLevel: LevelId;
  /** Sessions where the AI judged the learner above the lesson level. */
  aboveLevel: number;
  shadowing: { attempts: number; avgScore: number | null; bestScore: number | null };
  weeks: { week: number; total: number; done: number; achieved: number }[];
};

type Row = {
  day: number;
  localDate: string;
  lesson: Lesson;
  summary: Summary | null;
  completed: boolean;
};

export function courseLength(plan: StudyPlan | null): number {
  return plan?.days.length || LAST_STUDY_DAY;
}

/** The learner completed the last day of their course. */
export function isCourseFinished(rows: { day: number; completed: boolean }[], totalDays: number): boolean {
  return rows.some((r) => r.completed && r.day >= totalDays);
}

function longestStreak(dates: string[]): number {
  const sorted = [...new Set(dates)].sort();
  let best = 0;
  let run = 0;
  for (const [i, d] of sorted.entries()) {
    run = i > 0 && shiftDays(sorted[i - 1], 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

export function buildCourseReport(input: {
  rows: Row[];
  totalDays: number;
  studyTimes: { localDate: string; seconds: number }[];
  startLevel: LevelId;
  endLevel: LevelId;
  shadowing: CourseReport["shadowing"];
}): CourseReport {
  const done = input.rows.filter((r) => r.completed).sort((a, b) => a.day - b.day);
  const words = new Set<string>();
  const frames = new Set<string>();
  const used = new Set<string>();
  const situations = new Set<string>();
  const errors = new Map<string, { issue: string; count: number; correction: string }>();
  const reviewItems = new Set<string>();
  let reviewDays = 0;

  for (const r of done) {
    for (const f of r.summary?.frames_used ?? []) used.add(f);
    for (const e of r.summary?.errors ?? []) {
      const key = e.issue.toLowerCase();
      const hit = errors.get(key);
      if (hit) hit.count++;
      else errors.set(key, { issue: e.issue, count: 1, correction: e.correction });
    }
    for (const item of r.summary?.review_items ?? []) reviewItems.add(item.toLowerCase());
    if (r.lesson.recap) {
      reviewDays++;
      continue;
    }
    situations.add(r.lesson.title.toLowerCase());
    for (const v of r.lesson.vocabulary) words.add(v.word.toLowerCase());
    for (const f of r.lesson.frames) frames.add(f);
  }

  const achieved = done.filter((r) => r.summary?.goal_status === "achieved").length;
  const dates = done.map((r) => r.localDate).sort();
  const firstDate = dates[0] ?? "";
  const lastDate = dates.at(-1) ?? "";
  const spanDays = firstDate ? Math.round((Date.parse(lastDate) - Date.parse(firstDate)) / 86_400_000) + 1 : 0;

  const weeks = Array.from({ length: Math.ceil(input.totalDays / WEEK_DAYS) }, (_, i) => {
    const fromDay = i * WEEK_DAYS + 1;
    const toDay = Math.min(fromDay + WEEK_DAYS - 1, input.totalDays);
    const inWeek = done.filter((r) => r.day >= fromDay && r.day <= toDay);
    return {
      week: i + 1,
      total: toDay - fromDay + 1,
      done: inWeek.length,
      achieved: inWeek.filter((r) => r.summary?.goal_status === "achieved").length,
    };
  });

  return {
    totalDays: input.totalDays,
    completed: done.length,
    firstDate,
    lastDate,
    spanDays,
    studySeconds: input.studyTimes.reduce((n, t) => n + t.seconds, 0),
    studyDays: input.studyTimes.filter((t) => t.seconds > 0).length,
    achieved,
    needsReview: done.filter((r) => r.summary?.goal_status === "needs_review").length,
    achievementRate: done.length ? Math.round((achieved / done.length) * 100) : 0,
    words: words.size,
    frames: frames.size,
    framesUsed: [...frames].filter((f) => used.has(f)).length,
    situations: situations.size,
    reviewDays,
    turns: done.reduce((n, r) => n + (r.summary?.turn_count ?? 0), 0),
    voiceTurns: done.reduce((n, r) => n + (r.summary?.voice_turns ?? 0), 0),
    longestStreak: longestStreak(dates),
    errors: [...errors.values()].reduce((n, e) => n + e.count, 0),
    topErrors: [...errors.values()].sort((a, b) => b.count - a.count).slice(0, 3),
    reviewItems: reviewItems.size,
    startLevel: input.startLevel,
    endLevel: input.endLevel,
    aboveLevel: done.filter((r) => r.summary?.level_signal === "above").length,
    shadowing: input.shadowing,
    weeks,
  };
}
