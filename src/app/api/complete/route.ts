import { authedRoute, json, readJson } from "@/server/http/api";
import { FINISH_GRACE_MS, LAST_STUDY_DAY } from "@/domain/access";
import { demoSummary, summarize } from "@/server/ai/coach";
import { aiConfig, isDemo } from "@/server/ai/config";
import { AIError, Problem } from "@/lib/errors";
import { normalizeLesson } from "@/domain/content";
import { framesUsed } from "@/domain/frames";
import { updateWorkingLevel } from "@/server/learning/lessons";
import { lockForSummary, OPEN_ALL_DAYS, ownedAttempt, releaseLock } from "@/server/learning/practice";
import { finishStudy } from "@/server/learning/study-time";
import { logUsage, reserveProviderCall } from "@/server/learning/usage";
import { prisma } from "@/server/db";
import { vnDate } from "@/lib/time";
import type { Summary, Turn } from "@/domain/types";

export const POST = authedRoute(async (req, user) => {
  const body = await readJson(req);
  const attempt = await ownedAttempt(user, body.attempt_id, false);
  if (attempt.summary) return json(attempt.summary);
  if (!attempt.wordsDone || !attempt.shadowDone) throw new Problem("Hãy hoàn thành phần từ vựng và shadowing trước.");
  const practice = attempt.practice;
  if (!practice) throw new Problem("Hãy bắt đầu phần thực hành trước.");
  if (!user.profile) throw new Problem("Chưa có hồ sơ.");

  const lockedAt = await lockForSummary(practice.id);
  if (!lockedAt) throw new Problem("Đang xử lý lượt nói. Hãy thử lại sau.", 409);
  try {
    const turns = (await prisma.practice.findUniqueOrThrow({ where: { id: practice.id } })).turns as Turn[];
    const lesson = normalizeLesson(attempt.lesson);
    const said = turns.filter((t) => t.role === "user").map((t) => t.text);
    let aiOff = isDemo || body.ai_off === true;
    let base: Awaited<ReturnType<typeof summarize>>[0] | null = null;
    let usage = {};
    if (!aiOff) {
      try {
        await reserveProviderCall(user.id, "summary");
        [base, usage] = await summarize(user.profile, lesson, turns);
      } catch (error) {
        if (!(error instanceof AIError) && !(error instanceof Problem)) throw error;
        aiOff = true;
      }
    }
    const summary: Summary = {
      ...(base ?? demoSummary(lesson, said)),
      mode: aiOff ? "demo" : aiConfig.mode,
      frames_used: lesson.frames.filter((_, i) => framesUsed(lesson.frames, said)[i]),
      turn_count: said.length,
      voice_turns: turns.filter((t) => t.input_mode === "voice").length,
      pronunciation_note: "Không chấm phát âm từ transcript. Số lượt nhập chữ không phải số lượt nói.",
    };
    await prisma.attempt.update({
      where: { id: attempt.id },
      data: { completed: true, summary, localDate: vnDate() },
    });
    await finishStudy(user.id, attempt.id);
    if (!aiOff) await logUsage(user.id, "summary", usage);
    await updateWorkingLevel(user.id, user.profile);
    if (attempt.day >= LAST_STUDY_DAY && !OPEN_ALL_DAYS) {
      await prisma.user.updateMany({
        where: { id: user.id, role: "LEARNER", isDemo: false, lockAt: null },
        data: { lockAt: new Date(Date.now() + FINISH_GRACE_MS) },
      });
    }
    return json(summary);
  } finally {
    await releaseLock(practice.id, lockedAt);
  }
});
