import { authedRoute, json, readJson } from "@/server/http/api";
import { isDemo } from "@/server/ai/config";
import { Problem } from "@/lib/errors";
import { LATE_TURN_MS, ownedAttempt, withPracticeLock } from "@/server/learning/practice";
import { takeTurn } from "@/server/learning/turn";
import { normalizeLesson } from "@/domain/content";

/** Text turns: demo mode and the fallback after the AI failed (browser speech recognition). */
export const POST = authedRoute(async (req, user) => {
  const body = await readJson(req);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < 1 || text.length > 1000) throw new Problem("Câu trả lời từ 1 đến 1.000 ký tự.");
  if (!user.profile) throw new Problem("Chưa có hồ sơ.");
  const profile = user.profile;

  const result = await withPracticeLock(
    user.id,
    body.session_id,
    async (practice, save) =>
      takeTurn({
        userId: user.id,
        profile,
        practice,
        lesson: normalizeLesson((await ownedAttempt(user, practice.attemptId)).lesson),
        text,
        inputMode: body.input_mode === "voice" ? "voice" : "text",
        aiOff: isDemo || body.ai_off === true,
        recordOnly: body.record_only === true,
        save,
      }),
    LATE_TURN_MS,
  );
  return json({ turns: result.turns, ai_off: result.aiOff, serverTime: Date.now() });
});
