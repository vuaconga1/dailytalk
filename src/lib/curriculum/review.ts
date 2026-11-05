import { createHash } from "node:crypto";
import { usesFrame } from "@/lib/frames";
import type { FrameNote, Lesson } from "@/lib/types";

/** Plan days that only review: no new words or frames, practice reuses the earlier days. */
export const REVIEW_DAYS = [7, 14, 21, 28, 30];
const SOURCE_COUNT = 6;
const TARGET_FRAMES = 4;

export function isReviewDay(day: number): boolean {
  return REVIEW_DAYS.includes(day);
}

/** The study days a review day draws from: the 6 latest non-review days before it, in order. */
export function reviewSources(day: number): number[] {
  const days: number[] = [];
  for (let d = day - 1; d >= 1 && days.length < SOURCE_COUNT; d--) if (!isReviewDay(d)) days.push(d);
  return days.reverse();
}

export type ReviewSource = {
  day: number;
  lesson: Lesson;
  /** Travel / interview module days: recapped, but today's frames prefer job days. */
  module: boolean;
};

type Pick = { day: number; frame: string; note?: FrameNote; pair: [string, string] };

/** A frame of `lesson` with the counterpart line and the learner line that uses it. */
function pickFrame(lesson: Lesson, preferred: number): Omit<Pick, "day"> | null {
  const order = [preferred, ...lesson.frames.keys()].filter((i, n, all) => i < lesson.frames.length && all.indexOf(i) === n);
  for (const i of order) {
    const line = lesson.dialogue.findIndex((l, n) => n % 2 === 1 && usesFrame(lesson.frames[i], l));
    if (line > 0) return { frame: lesson.frames[i], note: lesson.frameNotes?.[i], pair: [lesson.dialogue[line - 1], lesson.dialogue[line]] };
  }
  return null;
}

/**
 * Review lesson: the authored review day supplies the situation and the coach's role; vocabulary and
 * frames are the earlier days' own, and shadowing strings together their exchanges that use the
 * 4 frames practised today (one from each of 4 days spread over the period).
 */
export function buildReviewLesson(base: Lesson, sources: ReviewSource[]): Lesson {
  const pool = sources.filter((s) => !s.module).length >= TARGET_FRAMES ? sources.filter((s) => !s.module) : sources;
  const spread = pool.length <= TARGET_FRAMES ? pool : [...Array(TARGET_FRAMES).keys()].map((k) => pool[Math.round((k * (pool.length - 1)) / (TARGET_FRAMES - 1))]);

  const picks: Pick[] = [];
  for (const [k, s] of spread.entries()) {
    const p = pickFrame(s.lesson, k);
    if (p) picks.push({ day: s.day, ...p });
  }
  for (const s of pool) {
    if (picks.length >= TARGET_FRAMES) break;
    for (const i of s.lesson.frames.keys()) {
      if (picks.length >= TARGET_FRAMES) break;
      const p = pickFrame(s.lesson, i);
      if (p && !picks.some((x) => x.frame === p.frame)) picks.push({ day: s.day, ...p });
    }
  }
  picks.sort((a, b) => a.day - b.day);

  const from = sources[0]?.day;
  const to = sources[sources.length - 1]?.day;
  const range = from === to ? `ngày ${from}` : `ngày ${from}–${to}`;
  const content = {
    title: base.title,
    situation: base.situation,
    level: base.level,
    goal: `Không có từ mới: dùng lại từ vựng và mẫu câu của ${range} trong một cuộc hội thoại trọn vẹn`,
    vocabulary: sources.flatMap((s) => s.lesson.vocabulary.map((v) => ({ ...v, day: s.day }))),
    frames: picks.map((p) => p.frame),
    frameNotes: picks.every((p) => p.note) ? picks.map((p) => p.note!) : undefined,
    dialogue: picks.flatMap((p) => p.pair),
    roleplay: {
      role: base.roleplay.role,
      goal: `Áp dụng những gì đã học ở ${range}: dùng đủ 4 mẫu câu ôn tập và các từ vựng đã học`,
      opening: base.roleplay.opening,
    },
    recap: {
      days: sources.map((s) => ({ day: s.day, title: s.lesson.title })),
      frames: sources.flatMap((s) => s.lesson.frames.map((frame, i) => ({ frame, day: s.day, note: s.lesson.frameNotes?.[i] }))),
      frameDays: picks.map((p) => p.day),
    },
  };
  const hash = createHash("sha256").update(JSON.stringify(content)).digest("hex").slice(0, 12);
  return { id: `review-${hash}`, version: base.version, ...content };
}
