import { canGenerateSpeech } from "@/server/ai/config";
import { json, readJson, staffRoute } from "@/server/http/api";
import { normalizeLesson } from "@/domain/content";
import { Problem } from "@/lib/errors";
import { cachedSpeech, lessonClips } from "@/server/learning/audio";
import { prisma } from "@/server/db";

export const maxDuration = 60;

/** Pre-generates the shared audio of one bank lesson (each dialogue line and each word). */
export const POST = staffRoute("manageLessons", async (req, staff) => {
  const row = await prisma.lessonContent.findUnique({ where: { key: String((await readJson(req)).key ?? "") } });
  if (!row) throw new Problem("Không tìm thấy bài.", 404);
  if (!canGenerateSpeech) throw new Problem("Chưa cấu hình TTS (TTS_BASE_URL hoặc AI_MODE=openai) để tạo audio.");
  const clips = lessonClips(normalizeLesson(row.lesson)).filter((c) => c.text);
  for (const { key, text } of clips) {
    await cachedSpeech({ key, text: text!, userId: staff.id, kind: "shared_audio", shared: true, reserve: false });
  }
  return json({ ok: true, clips: clips.length });
});
