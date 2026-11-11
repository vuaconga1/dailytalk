import "server-only";
import { toFile } from "openai";
import type { Lesson } from "@/domain/types";
import { AIError } from "@/lib/errors";
import { aiConfig, call, canGenerateSpeech, isDemo, openai, ttsClient, ttsConfig } from "./config";
import { transcribePrompt, VOICE_STYLE } from "./prompts";

/** `lesson` gives the model today's words so they are spelled right (the learner's errors are kept). */
export async function transcribe(audio: Buffer, mime: string, lesson?: Lesson): Promise<string> {
  if (isDemo) throw new AIError("Ghi âm để AI nhận dạng cần cấu hình API; demo hỗ trợ nhập câu.");
  const ext = mime.includes("mp4") ? "mp4" : mime.includes("webm") ? "webm" : mime.includes("ogg") ? "ogg" : "wav";
  const file = await toFile(audio, `recording.${ext}`, { type: mime });
  const result = await call(async () =>
    (await openai()).audio.transcriptions.create({
      file,
      model: aiConfig.stt,
      language: "en",
      ...(lesson ? { prompt: transcribePrompt(lesson) } : {}),
    }),
  );
  return result.text.trim();
}

export async function speech(input: string): Promise<Buffer> {
  if (!canGenerateSpeech) throw new AIError("Chưa cấu hình dịch vụ giọng đọc (TTS).");
  const res = await call(async () =>
    (await ttsClient()).audio.speech.create({
      model: ttsConfig.model,
      voice: ttsConfig.voice,
      input,
      // Only the gpt-4o TTS family accepts style instructions; older models reject the field.
      ...(ttsConfig.model.startsWith("gpt-4o") ? { instructions: VOICE_STYLE } : {}),
      response_format: "mp3",
    }),
  );
  return Buffer.from(await res.arrayBuffer());
}
