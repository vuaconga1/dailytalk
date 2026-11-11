import { authedRoute, json, readJson } from "@/server/http/api";
import { reply, scriptedReply } from "@/server/ai/coach";
import { isDemo } from "@/server/ai/config";
import { AIError, Problem } from "@/lib/errors";
import { MAX_TURNS, ownedAttempt, withPracticeLock } from "@/server/learning/practice";
import { logUsage, reserveProviderCall } from "@/server/learning/usage";
import { prisma } from "@/server/db";
import { normalizeLesson } from "@/domain/content";
import type { Turn } from "@/domain/types";

export const POST = authedRoute(async (req, user) => {
  const body = await readJson(req);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < 1 || text.length > 1000) throw new Problem("Câu trả lời từ 1 đến 1.000 ký tự.");
  if (!user.profile) throw new Problem("Chưa có hồ sơ.");
  const profile = user.profile;
  let aiOff = isDemo || body.ai_off === true;

  const turns = await withPracticeLock(user.id, body.session_id, async (practice) => {
    const turns = practice.turns as Turn[];
    if (turns.length > MAX_TURNS * 2) throw new Problem(`Đã đạt giới hạn ${MAX_TURNS} lượt cho phiên này.`, 409);
    turns.push({ role: "user", text, input_mode: body.input_mode === "voice" ? "voice" : "text" });
    if (body.record_only === true) {
      await prisma.practice.update({ where: { id: practice.id }, data: { turns } });
      return turns;
    }
    const lesson = normalizeLesson((await ownedAttempt(user, practice.attemptId)).lesson);
    let answer = "";
    if (!aiOff) {
      try {
        await reserveProviderCall(user.id, "conversation");
        const [line, usage] = await reply(profile, lesson, turns, MAX_TURNS);
        answer = line;
        await logUsage(user.id, "conversation", usage);
      } catch (error) {
        if (!(error instanceof AIError) && !(error instanceof Problem)) throw error;
        aiOff = true;
      }
    }
    if (aiOff) answer = scriptedReply(lesson, turns);
    turns.push({ role: "assistant", text: answer });
    await prisma.practice.update({ where: { id: practice.id }, data: { turns } });
    return turns;
  });
  return json({ turns, ai_off: aiOff, serverTime: Date.now() });
});
