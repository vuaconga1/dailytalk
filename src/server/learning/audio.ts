import "server-only";
import type { Lesson } from "@/domain/types";
import { aiConfig } from "@/server/ai/config";
import { speech } from "@/server/ai/speech";
import { prisma } from "@/server/db";
import { publicUrl, putObject } from "@/server/integrations/r2";
import { logUsage, reserveProviderCall, sha256 } from "./usage";

export type SpeechResult = { url: string } | { audio: Buffer };

type SpeechRequest = {
  key: string;
  text: string;
  userId: string;
  kind: string;
  /** Shared lesson audio goes to R2 (when configured); per-session replies stay in the DB. */
  shared?: boolean;
  /** Staff pre-generation is not limited by the learner's daily AI quota. */
  reserve?: boolean;
};

/** TTS audio generated once per key and reused by every learner. */
export async function cachedSpeech({ key, text, userId, kind, shared = false, reserve = true }: SpeechRequest): Promise<SpeechResult> {
  const hit = await prisma.audioClip.findUnique({ where: { key } });
  const hitUrl = hit?.r2Key ? publicUrl(hit.r2Key) : null;
  if (hitUrl) return { url: hitUrl };
  if (hit?.data) return { audio: Buffer.from(hit.data) };

  if (reserve) await reserveProviderCall(userId, kind);
  const audio = await speech(text);
  const r2Key = shared ? `daily-speaking/audio/${key}.mp3` : null;
  const uploaded = r2Key !== null && (await putObject(r2Key, audio, "audio/mpeg"));
  const data = uploaded ? { r2Key, data: null } : { r2Key: null, data: new Uint8Array(audio) };
  if (hit) {
    // Row points at R2 but R2 is no longer configured.
    await prisma.audioClip.update({
      where: { key },
      data: { ...data, bytes: audio.length },
    });
  } else {
    await prisma.audioClip.createMany({
      data: [{ key, bytes: audio.length, ...data }],
      skipDuplicates: true,
    });
  }
  await logUsage(userId, kind, { characters: text.length }, aiConfig.tts);
  const url = uploaded ? publicUrl(r2Key) : null;
  return url ? { url } : { audio };
}

/** Key of one shared shadowing clip: `line` is a dialogue index or "all". */
export function lessonAudio(lesson: Lesson, line: number | "all") {
  const text = line === "all" ? lesson.dialogue.join(" ") : lesson.dialogue[line];
  return {
    text,
    key: sha256(JSON.stringify([aiConfig.tts, aiConfig.voice, text])),
  };
}

export function speechResponse(result: SpeechResult): Response {
  if ("url" in result) return Response.redirect(result.url, 302);
  return new Response(new Uint8Array(result.audio), {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
