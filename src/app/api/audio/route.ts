import { authedRoute } from "@/server/http/api";
import { isDemo } from "@/server/ai/config";
import { normalizeLesson } from "@/domain/content";
import { Problem } from "@/lib/errors";
import { cachedSpeech, lessonAudio, speechResponse } from "@/server/learning/audio";
import { prisma } from "@/server/db";

/** Shared shadowing audio of a lesson the learner has been given: the whole dialogue or one line. */
export const GET = authedRoute(async (req, user) => {
  const id = req.nextUrl.searchParams.get("lesson") ?? "";
  if (!id || id.length > 100) throw new Problem("Không tìm thấy bài.", 404);
  const attempt = await prisma.attempt.findFirst({
    where: { userId: user.id, lesson: { path: ["id"], equals: id } },
    select: { lesson: true },
  });
  if (!attempt) throw new Problem("Bài không thuộc lộ trình của bạn.", 403);
  if (isDemo) throw new Problem("Demo dùng giọng đọc trình duyệt.");
  const lesson = normalizeLesson(attempt.lesson);
  const line = req.nextUrl.searchParams.get("line") ?? "all";
  if (line !== "all" && !/^\d+$/.test(line)) throw new Problem("Câu không hợp lệ.");
  const { text, key } = lessonAudio(lesson, line === "all" ? "all" : Number(line));
  if (!text) throw new Problem("Câu không hợp lệ.");
  return speechResponse(await cachedSpeech({ key, text, userId: user.id, kind: "shared_audio", shared: true }));
});
