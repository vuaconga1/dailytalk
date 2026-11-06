import "server-only";
import type { Lesson } from "@/domain/types";
import { Problem } from "@/lib/errors";
import { canGenerateSpeech, ttsConfig } from "@/server/ai/config";
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

  if (!canGenerateSpeech) throw new Problem("Bài này chưa có audio.", 404);
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
  await logUsage(userId, kind, { characters: text.length }, ttsConfig.model);
  const url = uploaded ? publicUrl(r2Key) : null;
  return url ? { url } : { audio };
}

/** Shared clips are keyed by voice + text, so the same sentence is generated once for every lesson. */
export function clipKey(text: string): string {
  return sha256(JSON.stringify([ttsConfig.model, ttsConfig.voice, text]));
}

/** Key of one shared shadowing clip: `line` is a dialogue index or "all". */
export function lessonAudio(lesson: Lesson, line: number | "all") {
  const text = line === "all" ? lesson.dialogue.join(" ") : lesson.dialogue[line];
  return { text, key: clipKey(text ?? "") };
}

/** Key of the pronunciation clip of one lesson word. */
export function wordAudio(lesson: Lesson, index: number) {
  const text = lesson.vocabulary[index]?.word;
  return { text, key: clipKey(text ?? "") };
}

/** Every clip the lesson player uses: each dialogue line, then each word. */
export function lessonClips(lesson: Lesson) {
  return [...lesson.dialogue.map((_, i) => lessonAudio(lesson, i)), ...lesson.vocabulary.map((_, i) => wordAudio(lesson, i))];
}

/** Whether every line / every word of a lesson already has a cached clip. */
export async function lessonAudioStatus(lesson: Lesson): Promise<{ lines: boolean; words: boolean }> {
  const lines = lesson.dialogue.map((_, i) => lessonAudio(lesson, i).key);
  const words = lesson.vocabulary.map((_, i) => wordAudio(lesson, i).key);
  if (!lines.length && !words.length) return { lines: false, words: false };
  const stored = await prisma.audioClip.findMany({ where: { key: { in: [...lines, ...words] } }, select: { key: true } });
  const have = new Set(stored.map((c) => c.key));
  return {
    lines: lines.length > 0 && lines.every((k) => have.has(k)),
    words: words.length > 0 && words.every((k) => have.has(k)),
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
