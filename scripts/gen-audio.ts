/**
 * Pre-generates shared shadowing + vocabulary audio with the configured TTS (Kokoro via TTS_BASE_URL).
 * Clips already cached are skipped, so it is safe to re-run.
 *
 *   npm run audio:gen                   (every lesson in the bank)
 *   npm run audio:gen -- --curriculum   (every rendering of the authored curriculum; can take hours on CPU)
 */
import "dotenv/config";
import { buildPlan, coverage, renderLesson } from "../src/domain/curriculum";
import { WORK_AUDIENCES } from "../src/domain/curriculum/types";
import { normalizeLesson } from "../src/domain/content";
import type { LearnerProfile, Lesson } from "../src/domain/types";
import { canGenerateSpeech, ttsConfig } from "../src/server/ai/config";
import { prisma } from "../src/server/db";
import { cachedSpeech, lessonClips } from "../src/server/learning/audio";

const base = {
  industry_other: "",
  position_other: "",
  goals: ["meetings"],
  self_level: "elementary",
  frequency: "weekly",
  study_time: "20:00",
  timezone: "Asia/Ho_Chi_Minh",
  reminders: false,
  classification: { level: "elementary", level_label: "", summary_vi: "", priorities: [] },
  working_level: "elementary",
} as const;

/** Each work audience alone picks every audience variant of a day; travel/recruiters add the module days. */
const AUDIENCE_SETS = [...WORK_AUDIENCES.map((a) => [a]), [...WORK_AUDIENCES, "travel", "recruiters"]];

function* curriculumLessons(): Generator<Lesson> {
  for (const { industry, position } of coverage()) {
    for (const audiences of AUDIENCE_SETS) {
      const profile = { ...base, industry, position, audiences } as unknown as LearnerProfile;
      for (const day of buildPlan(profile).days) {
        const lesson = day.ref ? renderLesson(day.ref, profile, "elementary") : null;
        if (lesson) yield lesson;
      }
    }
  }
}

async function bankLessons(): Promise<Lesson[]> {
  const rows = await prisma.lessonContent.findMany({ select: { lesson: true } });
  return rows.map((r) => normalizeLesson(r.lesson));
}

async function main() {
  if (!canGenerateSpeech) throw new Error("Cần TTS_BASE_URL (vd http://localhost:8880/v1) và TTS_MODEL để tạo audio.");
  const staff = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!staff) throw new Error("Chưa có tài khoản admin (npm run seed:admin).");

  const lessons = process.argv.includes("--curriculum") ? [...curriculumLessons()] : await bankLessons();
  const clips = new Map<string, string>();
  for (const lesson of lessons) for (const { key, text } of lessonClips(lesson)) if (text) clips.set(key, text);
  const have = new Set(
    (await prisma.audioClip.findMany({ where: { key: { in: [...clips.keys()] } }, select: { key: true } })).map((c) => c.key),
  );
  const todo = [...clips].filter(([key]) => !have.has(key));
  console.log(`${ttsConfig.model}/${ttsConfig.voice}: ${lessons.length} bài, ${clips.size} clip, cần tạo ${todo.length}.`);

  let done = 0;
  let failed = 0;
  for (const [key, text] of todo) {
    try {
      await cachedSpeech({ key, text, userId: staff.id, kind: "shared_audio", shared: true, reserve: false });
      done++;
    } catch (error) {
      failed++;
      console.error(`✗ "${text.slice(0, 60)}": ${(error as Error).message}`);
    }
    if ((done + failed) % 20 === 0 || done + failed === todo.length) console.log(`${done + failed}/${todo.length}`);
  }
  console.log(`Xong: ${done} clip mới, ${failed} lỗi.`);
  process.exitCode = failed ? 1 : 0;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
