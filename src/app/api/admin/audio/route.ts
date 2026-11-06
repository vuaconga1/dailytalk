import { isDemo } from "@/server/ai/config";
import { json, readJson, staffRoute } from "@/server/http/api";
import { normalizeLesson } from "@/domain/content";
import { Problem } from "@/lib/errors";
import { cachedSpeech, lessonAudio } from "@/server/learning/audio";
import { prisma } from "@/server/db";

export const maxDuration = 60;

/** Pre-generates the shared shadowing audio of one bank lesson (whole dialogue + each line). */
export const POST = staffRoute("manageLessons", async (req, staff) => {
  const row = await prisma.lessonContent.findUnique({ where: { key: String((await readJson(req)).key ?? "") } });
  if (!row) throw new Problem("Không tìm thấy bài.", 404);
  if (isDemo) throw new Problem("Cần AI_MODE=openai để tạo audio.");
  const lesson = normalizeLesson(row.lesson);
  const clips = [lessonAudio(lesson, "all"), ...lesson.dialogue.map((_, i) => lessonAudio(lesson, i))];
  for (const { key, text } of clips) {
    await cachedSpeech({ key, text, userId: staff.id, kind: "shared_audio", shared: true, reserve: false });
  }
  return json({ ok: true, clips: clips.length });
});
