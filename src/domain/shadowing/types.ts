import type { ShadowingStatus } from "@/generated/prisma/client";
import type { CueTiming } from "./cues";
import type { ErrorSummary, ShadowingGrade, WordResult } from "./scoring";
import { lineKey, transcriptLines } from "./transcript";

export type LineAnnotation = { ipa: string | null; translation: string | null };
export type StoredAnnotations = { version: 1; lines: { text: string; ipa?: string | null; translation?: string | null }[] };

const MAX_ANNOTATION = 1000;

function clip(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, MAX_ANNOTATION) : null;
}

/** Pairs stored annotations with the current sentences by `lineKey`; null when none match. */
export function matchAnnotations(raw: unknown, transcript: string): LineAnnotation[] | null {
  const lines = (raw as Partial<StoredAnnotations> | null)?.lines;
  if (!Array.isArray(lines)) return null;
  const byKey = new Map<string, LineAnnotation>();
  for (const l of lines) {
    if (!l || typeof l.text !== "string") continue;
    const entry = { ipa: clip(l.ipa), translation: clip(l.translation) };
    if (entry.ipa || entry.translation) byKey.set(lineKey(l.text), entry);
  }
  const out = transcriptLines(transcript).map((l) => byKey.get(lineKey(l.text)) ?? { ipa: null, translation: null });
  return out.some((a) => a.ipa || a.translation) ? out : null;
}

export type ShadowingCatalogItem = { slug: string; title: string; level: string | null; youtubeId: string };

export type PublicShadowingExercise = {
  id: string;
  slug: string;
  title: string;
  level: string | null;
  instructions: string | null;
  youtubeId: string;
  durationSec: number | null;
  maxRecordSeconds: number;
  transcript: string;
  cues: CueTiming[] | null;
  annotations: LineAnnotation[] | null;
};

export type ShadowingAttemptResult = Omit<ShadowingGrade, "wordResults" | "errorSummary"> & {
  attemptId: string;
  sttProvider: string;
  recognizedText: string;
  transcript: string;
  createdAt: string;
  wordResults: WordResult[];
  errorSummary: ErrorSummary;
  recordingUrl: string | null;
  recordingExpiresAt: string | null;
};

export type ShadowingHistoryItem = {
  attemptId: string;
  score: number;
  correctCount: number;
  totalWords: number;
  createdAt: string;
  hasRecording: boolean;
};

export const STATUS_LABELS: Record<ShadowingStatus, string> = { DRAFT: "Nháp", PUBLISHED: "Đang hiện", ARCHIVED: "Lưu trữ" };

export const STT_PROVIDERS = ["web-speech"] as const;
export type SttProvider = (typeof STT_PROVIDERS)[number];

export const RECORD_SECONDS = { min: 5, max: 300, default: 30 } as const;
export const RECORDING_TTL_DAYS = 18;
export const MAX_RECORDING_BYTES = 4 * 1024 * 1024;
export const MAX_RECOGNIZED_CHARS = 5000;
export const MAX_ALTERNATIVES_CHARS = 50_000;
