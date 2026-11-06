import { authedRoute, json, MAX_BODY_BYTES } from "@/server/http/api";
import { aiConfig } from "@/server/ai/config";
import { transcribe } from "@/server/ai/speech";
import { normalizeLesson } from "@/domain/content";
import { Problem } from "@/lib/errors";
import { ownedAttempt, withPracticeLock } from "@/server/learning/practice";
import { logUsage, reserveProviderCall } from "@/server/learning/usage";

const AUDIO_TYPES = new Set(["audio/webm", "audio/mp4", "audio/wav", "audio/ogg"]);

export const POST = authedRoute(async (req, user) => {
  const mime = (req.headers.get("content-type") ?? "").split(";")[0];
  if (!AUDIO_TYPES.has(mime)) throw new Problem("Định dạng ghi âm chưa hỗ trợ.");
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) throw new Problem("Bản ghi tối đa 4 MB.", 413);
  const audio = Buffer.from(await req.arrayBuffer());
  if (audio.length > MAX_BODY_BYTES) throw new Problem("Bản ghi tối đa 4 MB.", 413);
  if (audio.length < 100) throw new Problem("Bản ghi quá ngắn.");

  const text = await withPracticeLock(user.id, req.headers.get("x-practice-id"), async (practice) => {
    const lesson = normalizeLesson((await ownedAttempt(user, practice.attemptId)).lesson);
    await reserveProviderCall(user.id, "transcribe");
    const text = await transcribe(audio, mime, lesson);
    await logUsage(user.id, "transcribe", { bytes: audio.length }, aiConfig.stt);
    return text;
  });
  return json({ text });
});
