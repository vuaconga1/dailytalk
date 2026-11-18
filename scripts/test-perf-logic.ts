/**
 * Regression checks for the web-performance lean-path changes.
 * Verifies domain logic stays equivalent (week review, course report, curriculum, lean helpers).
 *
 *   npx tsx scripts/test-perf-logic.ts
 */
import assert from "node:assert/strict";
import { buildCourseReport } from "../src/domain/course-report";
import { normalizeLesson, LESSONS } from "../src/domain/content";
import { buildPlan, loadCluster, memberFor, renderLesson } from "../src/domain/curriculum";
import { classify } from "../src/domain/classify";
import { normalizeLessonLean, toLessonLean } from "../src/domain/lesson-lean";
import type { ProfileInput } from "../src/domain/profile";
import type { LearnerProfile, Summary } from "../src/domain/types";
import { buildWeekReview, weekOf } from "../src/domain/week";
import { shiftDays } from "../src/lib/time";

let failed = 0;
function check(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      console.log(`✓ ${name}`);
    } catch (e) {
      failed++;
      console.error(`✗ ${name}`);
      console.error(e);
    }
  })();
}

function sampleSummary(partial: Partial<Summary> = {}): Summary {
  return {
    overview: "ok",
    strengths: [],
    improvements: [],
    next_step: "next",
    goal_status: "achieved",
    evidence: [],
    errors: [{ issue: "Article", example: "I am sales", correction: "I am a sales exec" }],
    review_items: ["nice to meet you"],
    frames_used: ["Nice to meet you."],
    level_signal: "match",
    mode: "demo",
    turn_count: 4,
    voice_turns: 3,
    pronunciation_note: "",
    ...partial,
  };
}

const INPUT: ProfileInput = {
  industry: "sales",
  industry_other: "",
  position: "nhan_vien_kinh_doanh",
  position_other: "",
  audiences: ["customers", "partners"],
  goals: ["meetings"],
  self_level: "elementary",
  frequency: "weekly",
  study_time: "20:00",
  timezone: "Asia/Ho_Chi_Minh",
  reminders: true,
};
const classification = classify(INPUT);
const PROFILE: LearnerProfile = { ...INPUT, classification, working_level: classification.level };

async function main() {
await check("toLessonLean / normalizeLessonLean round-trip keeps week fields", () => {
  const lesson = normalizeLesson(LESSONS.L01);
  const lean = toLessonLean(lesson);
  const back = normalizeLessonLean(lean);
  assert.equal(back.title, lesson.title);
  assert.equal(back.level, lesson.level);
  assert.deepEqual(
    back.vocabulary.map((v) => v.word),
    lesson.vocabulary.map((v) => v.word),
  );
  assert.deepEqual(back.frames, lesson.frames);
});

await check("buildWeekReview(lean) matches buildWeekReview(full lesson fields used)", () => {
  const lessons = [LESSONS.L01, LESSONS.L02, LESSONS.L03].map(normalizeLesson);
  const fullRows = lessons.map((lesson, i) => ({
    day: i + 1,
    lesson: toLessonLean(lesson),
    summary: sampleSummary({
      goal_status: i === 1 ? ("needs_review" as const) : ("achieved" as const),
      frames_used: [lesson.frames[0]],
    }),
    completed: true,
  }));
  const fromFullShape = lessons.map((lesson, i) => ({
    day: i + 1,
    lesson: {
      title: lesson.title,
      situation: lesson.situation,
      level: lesson.level,
      goal: lesson.goal,
      vocabulary: lesson.vocabulary.map((v) => ({ word: v.word, meaning: v.meaning })),
      frames: lesson.frames,
      ...(lesson.recap ? { recap: lesson.recap } : {}),
    },
    summary: fullRows[i].summary,
    completed: true,
  }));
  const a = buildWeekReview(1, fullRows);
  const b = buildWeekReview(1, fromFullShape);
  assert.deepEqual(a, b);
  assert.equal(a.done, 3);
  assert.equal(a.achieved, 2);
  assert.ok(a.words.length >= 1);
  assert.ok(a.frames.length >= 1);
});

await check("weekOf boundaries unchanged", () => {
  assert.deepEqual(weekOf(1), { week: 1, fromDay: 1, toDay: 7 });
  assert.deepEqual(weekOf(8), { week: 2, fromDay: 8, toDay: 14 });
  assert.deepEqual(weekOf(30), { week: 5, fromDay: 29, toDay: 30 });
});

await check("buildCourseReport with lessonLean equals full-lesson vocabulary/frame counts", () => {
  const lessons = [LESSONS.L01, LESSONS.L11, LESSONS.L12].map(normalizeLesson);
  const rows = lessons.map((lesson, i) => ({
    day: i + 1,
    localDate: `2026-01-0${i + 1}`,
    lesson: toLessonLean(lesson),
    summary: sampleSummary({ frames_used: lesson.frames.slice(0, 2) }),
    completed: true,
  }));
  const report = buildCourseReport({
    rows,
    totalDays: 30,
    studyTimes: rows.map((r) => ({ localDate: r.localDate, seconds: 900 })),
    startLevel: "elementary",
    endLevel: "elementary",
    shadowing: { attempts: 2, avgScore: 80, bestScore: 90 },
  });
  assert.equal(report.completed, 3);
  assert.equal(report.achieved, 3);
  assert.ok(report.words > 0);
  assert.ok(report.frames > 0);
  assert.equal(report.studySeconds, 2700);
});

await check("curriculum: one cluster lazy-loads; buildPlan is 30 days; renderLesson fills refs", async () => {
  const member = memberFor(PROFILE);
  const cluster = await loadCluster(member.cluster);
  assert.equal(cluster.days.length, 30);
  const plan = await buildPlan(PROFILE);
  assert.equal(plan.days.length, 30);
  assert.ok(plan.goal.includes("công việc"));
  const first = plan.days[0];
  assert.ok(first.ref);
  const lesson = await renderLesson(first.ref!, PROFILE, "elementary");
  assert.ok(lesson);
  assert.ok(lesson!.title.length > 0);
  assert.equal(lesson!.vocabulary.length, 5);
  assert.equal(lesson!.frames.length, 4);
  assert.equal(lesson!.dialogue.length, 8);
  // No unfilled placeholders in rendered lesson
  const blob = JSON.stringify(lesson);
  assert.equal(blob.match(/\{[A-Za-z_]+\}/g), null);
});

await check("inactive support window math unchanged (3 days)", () => {
  const today = "2026-11-18";
  const last = "2026-11-10";
  assert.ok(last <= shiftDays(today, -3));
  assert.ok("2026-11-16" > shiftDays(today, -3));
});

await check("history title fallback: lessonTitle || plannedTitle semantics", () => {
  const title = (lessonTitle: string | null, plannedTitle: string | null) => lessonTitle || plannedTitle || "";
  assert.equal(title("Actual", "Planned"), "Actual");
  assert.equal(title(null, "Planned"), "Planned");
  assert.equal(title(null, null), "");
});

await check("lessonLean missing falls back to lessonTitle", () => {
  const lean = normalizeLessonLean(null, "Fallback title");
  assert.equal(lean.title, "Fallback title");
  assert.deepEqual(lean.frames, []);
});

await check("DB: lean week review matches full-lesson week review for a real learner", async () => {
  const { prisma } = await import("../src/server/db");
  try {
    const user = await prisma.attempt.findFirst({
      where: { completed: true, lessonTitle: { not: null } },
      select: { userId: true },
    });
    if (!user) {
      console.log("  (skip — no completed attempts with lessonTitle yet)");
      return;
    }
    const rows = await prisma.attempt.findMany({
      where: { userId: user.userId, day: { gte: 1, lte: 7 } },
      select: { day: true, lesson: true, lessonTitle: true, lessonLean: true, summary: true, completed: true },
      orderBy: { day: "asc" },
    });
    if (!rows.length) {
      console.log("  (skip — no week-1 rows)");
      return;
    }
    if (rows.every((r) => r.lessonLean == null)) {
      console.log("  (skip — lessonLean not backfilled on these rows)");
      return;
    }
    const { normalizeLesson } = await import("../src/domain/content");
    const leanRows = rows.map((r) => ({
      day: r.day,
      lesson: normalizeLessonLean(r.lessonLean, r.lessonTitle ?? ""),
      summary: r.summary as Summary | null,
      completed: r.completed,
    }));
    const fullRows = rows.map((r) => ({
      day: r.day,
      lesson: toLessonLean(normalizeLesson(r.lesson)),
      summary: r.summary as Summary | null,
      completed: r.completed,
    }));
    assert.deepEqual(buildWeekReview(1, leanRows), buildWeekReview(1, fullRows));
  } finally {
    await prisma.$disconnect();
  }
});

console.log(failed ? `\nFAILED: ${failed} check(s)` : "\nOK: all logic checks passed");
process.exitCode = failed ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
