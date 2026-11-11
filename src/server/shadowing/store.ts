import "server-only";
import { randomBytes } from "node:crypto";
import { can } from "@/domain/access";
import { buildCues, validateCues, type CaptionWord } from "@/domain/shadowing/cues";
import { gradeShadowing, pickClosestAlternatives, type ErrorSummary, type WordResult } from "@/domain/shadowing/scoring";
import { transcriptLines } from "@/domain/shadowing/transcript";
import {
  matchAnnotations,
  MAX_RECOGNIZED_CHARS,
  RECORDING_TTL_DAYS,
  type PublicShadowingExercise,
  type ShadowingAttemptResult,
  type ShadowingCatalogItem,
  type ShadowingHistoryItem,
  type StoredAnnotations,
} from "@/domain/shadowing/types";
import { Prisma, type ShadowingAttempt, type ShadowingExercise } from "@/generated/prisma/client";
import { Problem } from "@/lib/errors";
import type { SessionUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { deletePrivateObject, getPrivateObject, putPrivateObject, r2Enabled } from "@/server/integrations/r2";
import { sentenceIpa } from "./ipa";

const RECORDING_PREFIX = "private/shadowing-recordings/";
const TTL_MS = RECORDING_TTL_DAYS * 24 * 60 * 60 * 1000;

export function slugify(title: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/, "");
  return base || "bai-shadowing";
}

export async function uniqueSlug(title: string, excludeId?: string): Promise<string> {
  const base = slugify(title);
  const taken = new Set(
    (
      await prisma.shadowingExercise.findMany({
        where: { slug: { startsWith: base }, ...(excludeId ? { id: { not: excludeId } } : {}) },
        select: { slug: true },
      })
    ).map((r) => r.slug),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const slug = `${base.slice(0, 60)}-${n}`;
    if (!taken.has(slug)) return slug;
  }
}

export function captionWordsOf(raw: unknown): CaptionWord[] {
  return Array.isArray(raw) ? (raw as CaptionWord[]) : [];
}

/** Timing and IPA derived from the transcript; recomputed whenever transcript or captions change. */
export function deriveContent(transcript: string, captionWords: CaptionWord[], youtubeId: string) {
  const cues = buildCues(transcript, captionWords, youtubeId);
  const annotations: StoredAnnotations = {
    version: 1,
    lines: transcriptLines(transcript).map((l) => ({ text: l.text, ipa: sentenceIpa(l.text) || null })),
  };
  return {
    cues: cues ? (cues as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
    annotations: annotations as unknown as Prisma.InputJsonValue,
  };
}

export async function listCatalog(): Promise<ShadowingCatalogItem[]> {
  return prisma.shadowingExercise.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { slug: true, title: true, level: true, youtubeId: true },
  });
}

export function toPublicExercise(row: ShadowingExercise): PublicShadowingExercise {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    level: row.level,
    instructions: row.instructions,
    youtubeId: row.youtubeId,
    durationSec: row.durationSec,
    maxRecordSeconds: row.maxRecordSeconds,
    transcript: row.transcript,
    cues: validateCues(row.cues, row.transcript, row.youtubeId),
    annotations: matchAnnotations(row.annotations, row.transcript),
  };
}

export async function getPublishedExercise(slug: string): Promise<ShadowingExercise | null> {
  if (!slug || slug.length > 80) return null;
  return prisma.shadowingExercise.findFirst({ where: { slug, status: "PUBLISHED" } });
}

/** Recognizes the container from its first bytes; the client's MIME type is not trusted. */
export function sniffRecording(bytes: Buffer): { mime: string; ext: string } | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return { mime: "audio/webm", ext: "webm" };
  if (bytes.subarray(0, 4).toString("latin1") === "OggS") return { mime: "audio/ogg", ext: "ogg" };
  if (bytes.subarray(4, 8).toString("latin1") === "ftyp") return { mime: "audio/mp4", ext: "m4a" };
  if (bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WAVE") return { mime: "audio/wav", ext: "wav" };
  return null;
}

type Submission = {
  user: SessionUser;
  exercise: ShadowingExercise;
  recognizedText: string;
  sttProvider: string;
  alternatives: unknown;
  recording: { bytes: Buffer; mime: string; ext: string } | null;
  durationMs: number | null;
};

/** Grades again on the server (client scores are never trusted) and stores the attempt + recording. */
export async function submitAttempt(s: Submission): Promise<ShadowingAttemptResult> {
  const recognized = (pickClosestAlternatives(s.exercise.transcript, s.alternatives) ?? s.recognizedText).trim().slice(0, MAX_RECOGNIZED_CHARS);
  if (!recognized) throw new Problem("Hệ thống chưa nghe được giọng nói. Hãy ghi âm lại.", 422);
  const grade = gradeShadowing(s.exercise.transcript, recognized);

  let r2Key: string | null = null;
  if (s.recording && r2Enabled()) {
    r2Key = `${RECORDING_PREFIX}${randomBytes(18).toString("base64url")}.${s.recording.ext}`;
    await putPrivateObject(r2Key, s.recording.bytes, s.recording.mime);
  }
  const stored = Boolean(s.recording);
  try {
    const attempt = await prisma.shadowingAttempt.create({
      data: {
        userId: s.user.id,
        exerciseId: s.exercise.id,
        sttProvider: s.sttProvider,
        recognizedText: recognized,
        normalizedText: grade.normalizedText,
        score: grade.score,
        wer: grade.wer,
        totalWords: grade.totalWords,
        correctCount: grade.correctCount,
        substitutionCount: grade.substitutionCount,
        deletionCount: grade.deletionCount,
        insertionCount: grade.insertionCount,
        wordResults: grade.wordResults as unknown as Prisma.InputJsonValue,
        errorSummary: grade.errorSummary as unknown as Prisma.InputJsonValue,
        recordingKey: stored ? (r2Key ? `r2:${r2Key}` : "db") : null,
        recordingMime: s.recording?.mime ?? null,
        recordingMs: s.durationMs,
        recordingExpiresAt: stored ? new Date(Date.now() + TTL_MS) : null,
        ...(s.recording && !r2Key ? { recording: { create: { data: new Uint8Array(s.recording.bytes) } } } : {}),
      },
    });
    void purgeExpiredRecordings().catch((e) => console.error("shadowing purge", e));
    return toResult(attempt, s.exercise.transcript);
  } catch (error) {
    if (r2Key) await deletePrivateObject(r2Key).catch(() => undefined);
    throw error;
  }
}

function hasRecording(a: Pick<ShadowingAttempt, "recordingKey" | "recordingExpiresAt">): boolean {
  return Boolean(a.recordingKey && a.recordingExpiresAt && a.recordingExpiresAt > new Date());
}

function toResult(a: ShadowingAttempt, transcript: string): ShadowingAttemptResult {
  const live = hasRecording(a);
  return {
    attemptId: a.id,
    sttProvider: a.sttProvider,
    recognizedText: a.recognizedText,
    transcript,
    createdAt: a.createdAt.toISOString(),
    score: a.score,
    wer: a.wer,
    totalWords: a.totalWords,
    correctCount: a.correctCount,
    substitutionCount: a.substitutionCount,
    deletionCount: a.deletionCount,
    insertionCount: a.insertionCount,
    normalizedText: a.normalizedText,
    wordResults: a.wordResults as unknown as WordResult[],
    errorSummary: a.errorSummary as unknown as ErrorSummary,
    recordingUrl: live ? `/api/shadowing/recording?id=${a.id}` : null,
    recordingExpiresAt: live ? a.recordingExpiresAt!.toISOString() : null,
  };
}

export async function historyFor(userId: string, slug: string): Promise<ShadowingHistoryItem[]> {
  const rows = await prisma.shadowingAttempt.findMany({
    where: { userId, exercise: { slug } },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, score: true, correctCount: true, totalWords: true, createdAt: true, recordingKey: true, recordingExpiresAt: true },
  });
  return rows.map((r) => ({
    attemptId: r.id,
    score: r.score,
    correctCount: r.correctCount,
    totalWords: r.totalWords,
    createdAt: r.createdAt.toISOString(),
    hasRecording: hasRecording(r),
  }));
}

/** Only the learner who made the attempt, or staff who can view learners. */
async function viewableAttempt(id: string, viewer: SessionUser) {
  if (!id || id.length > 40) throw new Problem("Không tìm thấy lần làm bài.", 404);
  const attempt = await prisma.shadowingAttempt.findUnique({ where: { id }, include: { exercise: { select: { transcript: true } } } });
  if (!attempt) throw new Problem("Không tìm thấy lần làm bài.", 404);
  if (attempt.userId !== viewer.id && !can(viewer.role, "viewLearners")) throw new Problem("Không có quyền xem lần làm bài này.", 403);
  return attempt;
}

export async function attemptResult(id: string, viewer: SessionUser): Promise<ShadowingAttemptResult> {
  const attempt = await viewableAttempt(id, viewer);
  return toResult(attempt, attempt.exercise.transcript);
}

export async function attemptRecording(id: string, viewer: SessionUser): Promise<{ data: Uint8Array; mime: string }> {
  const attempt = await viewableAttempt(id, viewer);
  const gone = () => new Problem("Bản ghi đã hết hạn lưu trữ.", 410);
  if (!hasRecording(attempt)) throw gone();
  const key = attempt.recordingKey!;
  const data = key.startsWith("r2:")
    ? await getPrivateObject(key.slice(3))
    : ((await prisma.shadowingRecording.findUnique({ where: { attemptId: id } }))?.data ?? null);
  if (!data) throw gone();
  return { data, mime: attempt.recordingMime ?? "application/octet-stream" };
}

async function deleteRecordings(attempts: { id: string; recordingKey: string | null }[]) {
  for (const a of attempts) {
    if (a.recordingKey?.startsWith("r2:")) await deletePrivateObject(a.recordingKey.slice(3)).catch((e) => console.error("shadowing delete", e));
  }
  const ids = attempts.map((a) => a.id);
  await prisma.shadowingRecording.deleteMany({ where: { attemptId: { in: ids } } });
  await prisma.shadowingAttempt.updateMany({ where: { id: { in: ids } }, data: { recordingKey: null } });
}

const PURGE_EVERY_MS = 10 * 60_000;
const PURGE_BATCH = 50;
let lastPurge = 0;

/** Deletes recordings older than the retention period; throttled per instance unless `force`. */
export async function purgeExpiredRecordings(force = false): Promise<number> {
  if (!force && Date.now() - lastPurge < PURGE_EVERY_MS) return 0;
  lastPurge = Date.now();
  const expired = await prisma.shadowingAttempt.findMany({
    where: { recordingKey: { not: null }, recordingExpiresAt: { lte: new Date() } },
    select: { id: true, recordingKey: true },
    take: PURGE_BATCH,
  });
  if (expired.length) await deleteRecordings(expired);
  return expired.length;
}

/** Removes the stored files of every attempt before the exercise (and its attempts) is deleted. */
export async function deleteExercise(id: string): Promise<void> {
  const attempts = await prisma.shadowingAttempt.findMany({ where: { exerciseId: id, recordingKey: { not: null } }, select: { id: true, recordingKey: true } });
  if (attempts.length) await deleteRecordings(attempts);
  await prisma.shadowingExercise.delete({ where: { id } });
}
