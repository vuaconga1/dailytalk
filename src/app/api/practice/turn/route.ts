import { authedRoute, json, readJson } from "@/lib/api";
import { reply } from "@/lib/ai";
import { Problem } from "@/lib/errors";
import { logUsage, MAX_TURNS, ownedAttempt, reserveProviderCall, withPracticeLock } from "@/lib/learning";
import { prisma } from "@/lib/prisma";
import { normalizeLesson } from "@/lib/content";
import type { Turn } from "@/lib/types";

export const POST = authedRoute(async (req, user) => {
  const body = await readJson(req);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < 1 || text.length > 1000) throw new Problem("Câu trả lời từ 1 đến 1.000 ký tự.");
  if (!user.profile) throw new Problem("Chưa có hồ sơ.");
  const profile = user.profile;

  const turns = await withPracticeLock(user.id, body.session_id, async (practice) => {
    const turns = practice.turns as Turn[];
    if (turns.length > MAX_TURNS * 2) throw new Problem(`Đã đạt giới hạn ${MAX_TURNS} lượt cho phiên này.`, 409);
    turns.push({ role: "user", text, input_mode: body.input_mode === "voice" ? "voice" : "text" });
    const lesson = normalizeLesson((await ownedAttempt(user, practice.attemptId)).lesson);
    await reserveProviderCall(user.id, "conversation");
    const [answer, usage] = await reply(profile, lesson, turns, MAX_TURNS);
    turns.push({ role: "assistant", text: answer });
    await prisma.practice.update({ where: { id: practice.id }, data: { turns } });
    await logUsage(user.id, "conversation", usage);
    return turns;
  });
  return json({ turns, serverTime: Date.now() });
});
