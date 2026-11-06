import { authedRoute, readJson } from "@/server/http/api";
import { ttsConfig } from "@/server/ai/config";
import { Problem } from "@/lib/errors";
import { cachedSpeech, speechResponse } from "@/server/learning/audio";
import { withPracticeLock } from "@/server/learning/practice";
import { sha256 } from "@/server/learning/usage";
import type { Turn } from "@/domain/types";

export const POST = authedRoute(async (req, user) => {
  const sessionId = (await readJson(req)).session_id;
  const result = await withPracticeLock(user.id, sessionId, async (practice) => {
    const turns = practice.turns as Turn[];
    const last = turns.at(-1);
    if (last?.role !== "assistant") throw new Problem("Chưa có câu trả lời.");
    const key = sha256(JSON.stringify([practice.id, turns.length, ttsConfig.model, ttsConfig.voice]));
    return cachedSpeech({ key, text: last.text, userId: user.id, kind: "reply_audio" });
  });
  return speechResponse(result);
});
