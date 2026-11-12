import { authedRoute, json, MAX_BODY_BYTES } from "@/server/http/api";
import { aiConfig } from "@/server/ai/config";
import { transcribe } from "@/server/ai/speech";
import { normalizeLesson } from "@/domain/content";
import { Problem } from "@/lib/errors";
import { LATE_TURN_MS, ownedAttempt, withPracticeLock } from "@/server/learning/practice";
import { takeTurn } from "@/server/learning/turn";
import { logUsageLater, reserveProviderCall } from "@/server/learning/usage";

const AUDIO_TYPES = new Set(["audio/webm", "audio/mp4", "audio/wav", "audio/ogg"]);

/** One voice turn: transcribes the recording, then saves it with the coach's answer. `turns` is null when nothing was heard. */
export const POST = authedRoute(async (req, user) => {
  const mime = (req.headers.get("content-type") ?? "").split(";")[0];
  if (!AUDIO_TYPES.has(mime)) throw new Problem("Định dạng ghi âm chưa hỗ trợ.");
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) throw new Problem("Bản ghi tối đa 4 MB.", 413);
  const audio = Buffer.from(await req.arrayBuffer());
  if (audio.length > MAX_BODY_BYTES) throw new Problem("Bản ghi tối đa 4 MB.", 413);
  if (audio.length < 100) throw new Problem("Bản ghi quá ngắn.");
  if (!user.profile) throw new Problem("Chưa có hồ sơ.");
  const profile = user.profile;

  const result = await withPracticeLock(
    user.id,
    req.headers.get("x-practice-id"),
    async (practice, save) => {
      const [attempt] = await Promise.all([ownedAttempt(user, practice.attemptId), reserveProviderCall(user.id, "transcribe", true)]);
      const lesson = normalizeLesson(attempt.lesson);
      const text = (await transcribe(audio, mime, lesson)).slice(0, 1000);
      logUsageLater(user.id, "transcribe", { bytes: audio.length }, aiConfig.stt);
      if (!text) return { text, turns: null, aiOff: false };
      return { text, ...(await takeTurn({ userId: user.id, profile, practice, lesson, text, inputMode: "voice", aiOff: false, save })) };
    },
    LATE_TURN_MS,
  );
  return json({ text: result.text, turns: result.turns, ai_off: result.aiOff, serverTime: Date.now() });
});
