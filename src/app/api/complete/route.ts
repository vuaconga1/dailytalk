import { authedRoute, json, readJson } from "@/lib/api";
import { aiConfig, summarize } from "@/lib/ai";
import { Problem } from "@/lib/errors";
import { normalizeLesson } from "@/lib/content";
import { framesUsed } from "@/lib/frames";
import { lockForSummary, logUsage, ownedAttempt, releaseLock, reserveProviderCall, updateWorkingLevel } from "@/lib/learning";
import { prisma } from "@/lib/prisma";
import { vnDate } from "@/lib/time";
import type { Summary, Turn } from "@/lib/types";

export const POST = authedRoute(async (req, user) => {
  const attempt = await ownedAttempt(user, (await readJson(req)).attempt_id, false);
  if (attempt.summary) return json(attempt.summary);
  if (!attempt.wordsDone || !attempt.shadowDone) throw new Problem("Hãy hoàn thành phần từ vựng và shadowing trước.");
  const practice = attempt.practice;
  if (!practice) throw new Problem("Hãy bắt đầu phần thực hành trước.");
  if (!user.profile) throw new Problem("Chưa có hồ sơ.");

  const lockedAt = await lockForSummary(practice.id);
  if (!lockedAt) throw new Problem("Đang xử lý lượt nói. Hãy thử lại sau.", 409);
  try {
    const turns = (await prisma.practice.findUniqueOrThrow({ where: { id: practice.id } })).turns as Turn[];
    await reserveProviderCall(user.id, "summary");
    const lesson = normalizeLesson(attempt.lesson);
    const [base, usage] = await summarize(user.profile, lesson, turns);
    const said = turns.filter((t) => t.role === "user").map((t) => t.text);
    const summary: Summary = {
      ...base,
      mode: aiConfig.mode,
      frames_used: lesson.frames.filter((_, i) => framesUsed(lesson.frames, said)[i]),
      turn_count: said.length,
      voice_turns: turns.filter((t) => t.input_mode === "voice").length,
      pronunciation_note: "Không chấm phát âm từ transcript. Số lượt nhập chữ không phải số lượt nói.",
    };
    await prisma.attempt.update({
      where: { id: attempt.id },
      data: { completed: true, summary, localDate: vnDate() },
    });
    await logUsage(user.id, "summary", usage);
    await updateWorkingLevel(user.id, user.profile);
    return json(summary);
  } finally {
    await releaseLock(practice.id, lockedAt);
  }
});
