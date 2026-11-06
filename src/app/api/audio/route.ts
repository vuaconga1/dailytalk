import { authedRoute } from "@/server/http/api";
import { normalizeLesson } from "@/domain/content";
import { Problem } from "@/lib/errors";
import { cachedSpeech, lessonAudio, speechResponse, wordAudio } from "@/server/learning/audio";
import { prisma } from "@/server/db";

/** Shared audio of a lesson the learner has been given: the whole dialogue, one line (`line`) or one word (`word`). */
export const GET = authedRoute(async (req, user) => {
  const id = req.nextUrl.searchParams.get("lesson") ?? "";
  if (!id || id.length > 100) throw new Problem("Không tìm thấy bài.", 404);
  const attempt = await prisma.attempt.findFirst({
    where: { userId: user.id, lesson: { path: ["id"], equals: id } },
    select: { lesson: true },
  });
  if (!attempt) throw new Problem("Bài không thuộc lộ trình của bạn.", 403);
  const lesson = normalizeLesson(attempt.lesson);
  const word = req.nextUrl.searchParams.get("word");
  const line = req.nextUrl.searchParams.get("line") ?? "all";
  if (word !== null ? !/^\d+$/.test(word) : line !== "all" && !/^\d+$/.test(line)) throw new Problem("Câu không hợp lệ.");
  const { text, key } = word !== null ? wordAudio(lesson, Number(word)) : lessonAudio(lesson, line === "all" ? "all" : Number(line));
  if (!text) throw new Problem("Câu không hợp lệ.");
  return speechResponse(await cachedSpeech({ key, text, userId: user.id, kind: "shared_audio", shared: true }));
});
