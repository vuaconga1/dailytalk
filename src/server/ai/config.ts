/** Server-only AI adapter. All models are configurable; no paid calls in demo. */
import "server-only";
import OpenAI from "openai";
import { profileLabels } from "@/domain/profile";
import { levelInfo } from "@/domain/profile-options";
import type { LearnerProfile } from "@/domain/types";
import { AIError } from "@/lib/errors";
import { prisma } from "@/server/db";

export type Usage = Record<string, unknown>;

function readConfig() {
  const explicitMode = process.env.AI_MODE?.trim();
  if (explicitMode && explicitMode !== "demo" && explicitMode !== "openai") {
    throw new Error("AI_MODE must be demo or openai");
  }
  const key = process.env.OPENAI_API_KEY?.trim() ?? "";
  // When an OpenAI API key is provided, enable openai mode unless explicitly forced to demo without key
  const mode: "demo" | "openai" = explicitMode === "openai" ? "openai" : key ? "openai" : (explicitMode as "demo" | "openai") || "demo";
  const model = process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-4o-mini";
  const stt = process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || "whisper-1";
  const tts = process.env.OPENAI_TTS_MODEL?.trim() || "tts-1";
  const voice = process.env.OPENAI_VOICE?.trim() || "alloy";
  const config = {
    mode,
    key,
    model,
    stt,
    tts,
    voice,
  } as const;
  if (mode === "openai" && !(config.model && config.stt && config.tts)) {
    throw new Error("AI_MODE=openai cần đủ ba tên model. Xem .env.example.");
  }
  return config;
}

export const aiConfig = readConfig();
export const isDemo = aiConfig.mode === "demo";

/** Text-to-speech: a self-hosted OpenAI-compatible server (Kokoro) when TTS_BASE_URL is set, otherwise OpenAI. */
export const ttsConfig = {
  baseUrl: process.env.TTS_BASE_URL?.trim() ?? "",
  model: process.env.TTS_BASE_URL?.trim() ? (process.env.TTS_MODEL?.trim() || "kokoro") : (aiConfig.tts || "tts-1"),
  voice: process.env.TTS_VOICE?.trim() || aiConfig.voice,
} as const;
/**
 * Without it only already-cached clips are served: production keeps TTS_MODEL/TTS_VOICE (so cache keys match)
 * but leaves TTS_BASE_URL empty, and an explicit TTS_MODEL is never sent to OpenAI.
 */
export const canGenerateSpeech = ttsConfig.baseUrl
  ? Boolean(ttsConfig.model)
  : !isDemo && Boolean(aiConfig.tts);

export const API_KEY_SETTING = "OPENAI_API_KEY";
/** Other server instances pick up a key changed in the admin console within this time. */
const KEY_TTL_MS = 30_000;
let cachedKey: { value: string; at: number } | null = null;

/** The admin-console key (AppSetting) wins over OPENAI_API_KEY from .env. */
export async function openaiKey(): Promise<string> {
  if (cachedKey && Date.now() - cachedKey.at < KEY_TTL_MS) return cachedKey.value;
  const row = await prisma.appSetting.findUnique({ where: { key: API_KEY_SETTING } });
  const value = row?.value || aiConfig.key;
  cachedKey = { value, at: Date.now() };
  return value;
}

export function resetOpenaiKey() {
  cachedKey = null;
}

let client: { key: string; sdk: OpenAI } | null = null;
export async function openai(): Promise<OpenAI> {
  const key = await openaiKey();
  if (!key) throw new AIError("Chưa cấu hình OPENAI_API_KEY.");
  if (client?.key !== key) client = { key, sdk: new OpenAI({ apiKey: key, timeout: 60_000, maxRetries: 0 }) };
  return client.sdk;
}

let tts: OpenAI | null = null;
export async function ttsClient(): Promise<OpenAI> {
  if (!ttsConfig.baseUrl) return openai();
  tts ??= new OpenAI({ apiKey: "kokoro", baseURL: ttsConfig.baseUrl, timeout: 120_000, maxRetries: 1 });
  return tts;
}

export async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AIError) throw error;
    console.error("AI provider call failed:", error instanceof Error ? error.message : error);
    throw new AIError("Không kết nối được dịch vụ AI. Hãy thử lại sau.", {
      cause: error,
    });
  }
}

export async function text(instructions: string, data: unknown, jsonMode: boolean, maxTokens = 2400): Promise<[unknown, Usage]> {
  const result = await call(async () =>
    (await openai()).responses.create({
      model: aiConfig.model,
      instructions,
      // json_object mode rejects input that never mentions "json"; the instructions don't count.
      input: jsonMode ? `Reply with a JSON object. Input data:\n${JSON.stringify(data)}` : JSON.stringify(data),
      max_output_tokens: jsonMode ? maxTokens : 400,
      store: false,
      ...(jsonMode ? { text: { format: { type: "json_object" as const } } } : {}),
    }),
  );
  const out = result.output_text;
  if (!out) throw new AIError("AI chưa trả về nội dung hợp lệ.");
  let value: unknown = out;
  if (jsonMode) {
    try {
      value = JSON.parse(out);
    } catch {
      throw new AIError("AI chưa trả về nội dung hợp lệ.");
    }
  }
  return [value, (result.usage ?? {}) as unknown as Usage];
}

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
export const isText = (v: unknown, max: number): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= max;
export const isTextList = (v: unknown, min: number, max: number, len: number): v is string[] =>
  Array.isArray(v) && v.length >= min && v.length <= max && v.every((t) => isText(t, len));

/** What the AI needs to know about the learner (labels, never raw ids). */
export function learnerContext(profile: LearnerProfile) {
  const labels = profileLabels(profile);
  return {
    industry: labels.industry,
    position: labels.position,
    communicates_with: labels.audiences,
    goals: labels.goals,
    level: levelInfo(profile.working_level ?? profile.classification.level).label,
    priorities: profile.classification.priorities.map((p) => p.label),
  };
}
