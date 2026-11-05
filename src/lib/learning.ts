import "server-only";
import { createHash } from "node:crypto";
import { canStudyDay } from "@/lib/access";
import { adaptDay, aiConfig, generateLesson, isDemo, speech, type DayTarget, type RecentSession } from "@/lib/ai";
import type { SessionUser } from "@/lib/auth";
import { fallbackLesson, normalizeLesson } from "@/lib/content";
import { CURRICULUM_LEVEL, curriculumMeta, isModuleRef, renderLesson } from "@/lib/curriculum";
import { buildReviewLesson, isReviewDay, reviewSources, type ReviewSource } from "@/lib/curriculum/review";
import { AIError, Problem } from "@/lib/errors";
import { profileLabels } from "@/lib/profile";
import { shiftLevel } from "@/lib/profile-options";
import { Prisma, type Practice } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { publicUrl, putObject } from "@/lib/r2";
import { vnDate, vnDayStart } from "@/lib/time";
import type {
  AttemptView,
  HistoryItem,
  LearnerProfile,
  Lesson,
  LevelId,
  PracticeView,
  StudyPlan,
  Summary,
  Turn,
  WeekReview,
} from "@/lib/types";
import { buildWeekReview, weekOf } from "@/lib/week";

export const DAILY_SECONDS = 180;
export const MAX_TURNS = 20;
/** Testing switch: every plan day is open, in any order, with no once-per-day limits. */
export const OPEN_ALL_DAYS = process.env.OPEN_ALL_DAYS?.trim() === "true";
/** A crashed request must not lock a practice session forever. */
const STALE_LOCK_MS = 90_000;

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function toPracticeView(p: Practice): PracticeView {
  return {
    id: p.id,
    deadline: p.deadline.getTime(),
    ended: p.ended,
    turns: p.turns as Turn[],
  };
}

type AttemptRow = Prisma.AttemptGetPayload<{ include: { practice: true } }>;

function toAttemptView(a: AttemptRow, locked = false): AttemptView {
  return {
    id: a.id,
    day: a.day,
    localDate: a.localDate,
    lesson: normalizeLesson(a.lesson),
    focus: a.focus,
    locked,
    wordsDone: a.wordsDone,
    shadowDone: a.shadowDone,
    completed: a.completed,
    summary: a.summary as Summary | null,
    practice: a.practice ? toPracticeView(a.practice) : null,
  };
}

async function recentSessions(userId: string): Promise<RecentSession[]> {
  const rows = await prisma.attempt.findMany({
    where: { userId, completed: true },
    orderBy: { day: "desc" },
    take: 5,
    select: { lesson: true, summary: true },
  });
  return rows.map((r) => {
    const lesson = normalizeLesson(r.lesson);
    const summary = r.summary as Summary | null;
    return {
      title: lesson.title,
      situation: lesson.situation,
      level: lesson.level,
      goalStatus: summary?.goal_status ?? "insufficient_evidence",
      levelSignal: summary?.level_signal,
      errors: (summary?.errors ?? []).map((e) => e.issue),
      reviewItems: summary?.review_items ?? [],
    };
  });
}

/** Reserves an AI call; false (use the rule-based path) when today's quota is used up. */
async function tryReserve(userId: string, kind: string): Promise<boolean> {
  if (isDemo) return false;
  try {
    await reserveProviderCall(userId, kind);
    return true;
  } catch (error) {
    if (!(error instanceof Problem)) throw error;
    return false;
  }
}

/** Bumped when the generation prompt changes, so the bank regenerates instead of reusing. */
const LESSON_VERSION = 4;

type BankEntry = {
  key: string;
  title: string;
  industry: string;
  position: string;
  level: LevelId;
  lesson: Lesson;
  source: string;
};

/** Returns the bank row's lesson (counting the use) or stores `make()`'s result under `key`. */
async function fromBank(key: string, make: () => Promise<BankEntry | null>): Promise<Lesson | null> {
  const hit = await prisma.lessonContent.findUnique({ where: { key } });
  if (hit) {
    await prisma.lessonContent.update({
      where: { key },
      data: { uses: { increment: 1 }, lastUsed: new Date() },
    });
    return normalizeLesson(hit.lesson);
  }
  const entry = await make();
  if (!entry) return null;
  await prisma.lessonContent.createMany({
    data: [
      {
        ...entry,
        lesson: entry.lesson as unknown as Prisma.InputJsonValue,
        uses: 1,
      },
    ],
    skipDuplicates: true,
  });
  return entry.lesson;
}

/**
 * Detailed content for today's situation. Curriculum entries are rendered for the learner's
 * position and audience; with AI on and a level different from the authored one, the lesson is
 * rewritten for that level. Entries without a curriculum ref (older roadmaps) are generated per
 * situation. Everything lands in the shared bank so learners with the same content reuse it.
 */
async function ensureLessonContent(user: SessionUser, target: DayTarget): Promise<{ lesson: Lesson; key: string | null }> {
  const profile = user.profile as LearnerProfile;
  const base = target.ref ? renderLesson(target.ref, profile, target.level) : null;

  if (base) {
    const meta = curriculumMeta(profile);
    const authored = {
      key: base.id,
      title: base.title,
      industry: meta.cluster,
      position: meta.job,
      level: CURRICULUM_LEVEL,
      source: "curriculum",
    };
    const stored = await fromBank(base.id, async () => ({
      ...authored,
      lesson: { ...base, level: CURRICULUM_LEVEL },
    }));
    const plain = {
      lesson: { ...(stored ?? base), level: target.level },
      key: base.id,
    };
    if (isDemo || target.level === CURRICULUM_LEVEL) return plain;

    const key = sha256(JSON.stringify(["adapt", base.id, target.level, LESSON_VERSION]));
    try {
      const adapted = await fromBank(key, async () => {
        if (!(await tryReserve(user.id, "lesson"))) return null;
        const [content, usage] = await generateLesson(profile, target, base);
        await logUsage(user.id, "lesson", usage);
        const lesson: Lesson = {
          ...content,
          id: key,
          version: LESSON_VERSION,
          title: base.title,
          situation: base.situation,
          level: target.level,
        };
        return {
          ...authored,
          key,
          level: target.level,
          lesson,
          source: "openai",
        };
      });
      return adapted ? { lesson: adapted, key } : plain;
    } catch (error) {
      if (error instanceof AIError) return plain;
      throw error;
    }
  }

  const labels = profileLabels(profile);
  const fallback = () => ({
    lesson: {
      ...fallbackLesson(target.title, target.situation),
      level: target.level,
    },
    key: null,
  });
  if (isDemo) return fallback();
  const title = target.title.toLowerCase().replace(/\s+/g, " ").trim();
  const key = sha256(JSON.stringify([labels.industry.toLowerCase(), labels.position.toLowerCase(), title, target.level, LESSON_VERSION]));
  try {
    const lesson = await fromBank(key, async () => {
      if (!(await tryReserve(user.id, "lesson"))) return null;
      const [content, usage] = await generateLesson(profile, target);
      await logUsage(user.id, "lesson", usage);
      const lesson: Lesson = { id: key, version: LESSON_VERSION, ...content };
      return {
        key,
        title: target.title,
        industry: labels.industry,
        position: labels.position,
        level: target.level,
        lesson,
        source: "openai",
      };
    });
    return lesson ? { lesson, key } : fallback();
  } catch (error) {
    if (error instanceof AIError) return fallback();
    throw error;
  }
}

/** Review day lesson from the lessons actually studied on its source days (the plan's for days not opened yet). */
async function reviewLesson(user: SessionUser, day: number, ref: string): Promise<Lesson | null> {
  const profile = user.profile as LearnerProfile;
  const plan = user.plan as StudyPlan;
  const base = renderLesson(ref, profile, CURRICULUM_LEVEL);
  if (!base) return null;
  const days = reviewSources(day);
  const studied = await prisma.attempt.findMany({
    where: { userId: user.id, day: { in: days } },
    select: { day: true, lesson: true },
  });
  const sources: ReviewSource[] = [];
  for (const d of days) {
    const planRef = plan.days[d - 1]?.ref;
    const row = studied.find((r) => r.day === d);
    const lesson = row ? normalizeLesson(row.lesson) : planRef ? renderLesson(planRef, profile, CURRICULUM_LEVEL) : null;
    if (lesson) sources.push({ day: d, lesson, module: isModuleRef(planRef) });
  }
  return sources.length ? buildReviewLesson(base, sources) : null;
}

/** Re-decides today's situation from recent results; the roadmap is only a reference. */
async function selectDay(user: SessionUser, day: number) {
  const profile = user.profile as LearnerProfile;
  const plan = user.plan as StudyPlan;
  const planned = plan.days[day - 1] ?? plan.days[plan.days.length - 1];
  if (isReviewDay(day) && planned.ref) {
    const review = await reviewLesson(user, day, planned.ref);
    if (review) {
      const choice = {
        title: planned.title,
        situation: planned.situation,
        focus: planned.focus,
        ref: planned.ref,
        level: profile.working_level ?? profile.classification.level,
        selectedBy: "plan" as const,
      };
      return { choice, planned, lesson: { ...review, level: choice.level }, key: null };
    }
  }
  const recent = await recentSessions(user.id);
  const useAi = recent.length > 0 && (await tryReserve(user.id, "select"));
  const [choice, usage] = await adaptDay(profile, planned, plan.days, recent, useAi);
  if (choice.selectedBy === "openai") await logUsage(user.id, "select", usage);
  const { lesson, key } = await ensureLessonContent(user, choice);
  return { choice, planned, lesson, key };
}

/**
 * Working level moves one step when the summaries say so: once on day 1 (to combine the
 * self-reported level with real performance), afterwards only after two consecutive
 * sessions at the current level point the same way.
 */
export async function updateWorkingLevel(userId: string, profile: LearnerProfile): Promise<LevelId> {
  const current = profile.working_level ?? profile.classification.level;
  const rows = await prisma.attempt.findMany({
    where: { userId, completed: true },
    orderBy: { day: "desc" },
    take: 2,
    select: { day: true, lesson: true, summary: true },
  });
  const signals = rows.filter((r) => normalizeLesson(r.lesson).level === current).map((r) => (r.summary as Summary | null)?.level_signal);
  const first = rows.length === 1 && rows[0].day === 1;
  const needed = first ? 1 : 2;
  let next = current;
  for (const dir of ["below", "above"] as const) {
    if (signals.length >= needed && signals.slice(0, needed).every((s) => s === dir)) {
      next = shiftLevel(current, dir === "above" ? 1 : -1);
    }
  }
  if (next !== current) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        profile: {
          ...profile,
          working_level: next,
        } as unknown as Prisma.InputJsonValue,
      },
    });
  }
  return next;
}

/**
 * Opens the next study day once the previous one is completed on an earlier date.
 * Not-yet-activated learners stay on their last (trial) session with `locked` set.
 */
export async function getTodayAttempt(user: SessionUser, requestedDay?: number): Promise<AttemptView> {
  if (!user.plan || !user.profile) throw new Problem("Hãy hoàn thành khảo sát trước.");
  if (OPEN_ALL_DAYS && requestedDay && Number.isInteger(requestedDay) && requestedDay >= 1 && requestedDay <= 30) {
    const existing = await prisma.attempt.findUnique({
      where: { userId_day: { userId: user.id, day: requestedDay } },
      include: { practice: true },
    });
    return existing ? toAttemptView(existing) : openDay(user, requestedDay);
  }
  const today = vnDate();
  const last = await prisma.attempt.findFirst({
    where: { userId: user.id },
    orderBy: { day: "desc" },
    include: { practice: true },
  });
  if (last && (!last.completed || (!OPEN_ALL_DAYS && last.localDate === today) || last.day >= 30)) {
    return toAttemptView(last, !OPEN_ALL_DAYS && last.completed && last.day < 30 && !canStudyDay(user, last.day + 1));
  }
  const day = last ? last.day + 1 : 1;
  if (last && !OPEN_ALL_DAYS && !canStudyDay(user, day)) return toAttemptView(last, true);
  return openDay(user, day);
}

async function openDay(user: SessionUser, day: number): Promise<AttemptView> {
  const today = vnDate();
  const { choice, planned, lesson, key } = await selectDay(user, day);
  try {
    const created = await prisma.attempt.create({
      data: {
        userId: user.id,
        day,
        localDate: today,
        lesson: lesson as unknown as Prisma.InputJsonValue,
        lessonKey: key,
        plannedTitle: planned.title,
        selectedBy: choice.selectedBy,
        focus: choice.focus,
      },
      include: { practice: true },
    });
    return toAttemptView(created);
  } catch (error) {
    // Concurrent renders (page + prefetches) open the same day; the loser reads the winner's row.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    const existing = await prisma.attempt.findUniqueOrThrow({
      where: { userId_day: { userId: user.id, day } },
      include: { practice: true },
    });
    return toAttemptView(existing);
  }
}

export async function getHistory(userId: string): Promise<HistoryItem[]> {
  const rows = await prisma.attempt.findMany({
    where: { userId },
    orderBy: { day: "desc" },
    select: {
      day: true,
      localDate: true,
      lesson: true,
      summary: true,
      completed: true,
    },
  });
  return rows.map((r) => {
    const l = normalizeLesson(r.lesson);
    return {
      day: r.day,
      date: r.localDate,
      title: l.title,
      situation: l.situation,
      level: l.level,
      goal: l.goal,
      completed: r.completed,
      summary: r.summary as Summary | null,
    };
  });
}

async function weekRows(where: Prisma.AttemptWhereInput) {
  const rows = await prisma.attempt.findMany({
    where,
    select: { day: true, lesson: true, summary: true, completed: true },
  });
  return rows.map((r) => ({
    ...r,
    lesson: normalizeLesson(r.lesson),
    summary: r.summary as Summary | null,
  }));
}

/** Reviews of every study week the learner has started, latest first. */
export async function getWeekReviews(userId: string): Promise<WeekReview[]> {
  const rows = await weekRows({ userId });
  const weeks = [...new Set(rows.map((r) => weekOf(r.day).week))].sort((a, b) => b - a);
  return weeks.map((w) => buildWeekReview(w, rows));
}

/** Review of the study week that contains `day`. */
export async function getWeekReview(userId: string, day: number): Promise<WeekReview> {
  const { week, fromDay, toDay } = weekOf(day);
  return buildWeekReview(week, await weekRows({ userId, day: { gte: fromDay, lte: toDay } }));
}

/** `requireAccess` is off only for summarising work the learner already did. */
export async function ownedAttempt(user: SessionUser, attemptId: unknown, requireAccess = true) {
  const attempt =
    typeof attemptId === "string" && attemptId
      ? await prisma.attempt.findFirst({
          where: { id: attemptId, userId: user.id },
          include: { practice: true },
        })
      : null;
  if (!attempt) throw new Problem("Không tìm thấy buổi học.", 404);
  if (requireAccess && !canStudyDay(user, attempt.day)) {
    throw new Problem("Tài khoản chưa được kích hoạt hoặc đã hết hạn. Vui lòng liên hệ chuyên viên WeWIN.", 403);
  }
  return attempt;
}

export async function logUsage(userId: string, kind: string, data: object, model: string | null = aiConfig.model) {
  await prisma.usage.create({
    data: { userId, kind, model, data: data as Prisma.InputJsonValue },
  });
}

/** Reserve BEFORE network I/O. Failures count too, limiting costly retries. */
export async function reserveProviderCall(userId: string, kind: string) {
  if (isDemo) return;
  const since = vnDayStart();
  const limit = Number(process.env.MAX_PROVIDER_CALLS_PER_USER_DAY ?? 90);
  const count = await prisma.usage.count({
    where: {
      userId,
      kind: { startsWith: "reserve_" },
      createdAt: { gte: since },
    },
  });
  if (count >= limit) throw new Problem("Đã đạt hạn mức yêu cầu AI trong ngày.", 429);
  await logUsage(userId, `reserve_${kind}`, {});
}

function unlockedSince(now: Date): Prisma.PracticeWhereInput {
  return {
    OR: [{ busySince: null }, { busySince: { lt: new Date(now.getTime() - STALE_LOCK_MS) } }],
  };
}

/** Runs `fn` while holding the session's AI lock; one provider call per session at a time. */
export async function withPracticeLock<T>(userId: string, practiceId: unknown, fn: (p: Practice) => Promise<T>): Promise<T> {
  if (typeof practiceId !== "string" || !practiceId) throw new Problem("Không tìm thấy phiên luyện tập.", 404);
  const now = new Date();
  const { count } = await prisma.practice.updateMany({
    where: {
      id: practiceId,
      userId,
      ended: false,
      deadline: { gt: now },
      ...unlockedSince(now),
    },
    data: { busySince: now },
  });
  if (!count) {
    const p = await prisma.practice.findFirst({
      where: { id: practiceId, userId },
    });
    if (!p) throw new Problem("Không tìm thấy phiên luyện tập.", 404);
    if (p.ended || p.deadline <= now) throw new Problem("Đã hết 3 phút hội thoại. Hãy xem tổng kết.", 409);
    throw new Problem("AI đang xử lý lượt trước. Vui lòng chờ.", 409);
  }
  try {
    return await fn(await prisma.practice.findUniqueOrThrow({ where: { id: practiceId } }));
  } finally {
    await prisma.practice.updateMany({
      where: { id: practiceId, busySince: now },
      data: { busySince: null },
    });
  }
}

/** Marks the session ended and locked for the summary call; false if another call holds it. */
export async function lockForSummary(practiceId: string): Promise<Date | null> {
  const now = new Date();
  const { count } = await prisma.practice.updateMany({
    where: { id: practiceId, ...unlockedSince(now) },
    data: { busySince: now, ended: true },
  });
  return count ? now : null;
}

export async function releaseLock(practiceId: string, lockedAt: Date) {
  await prisma.practice.updateMany({
    where: { id: practiceId, busySince: lockedAt },
    data: { busySince: null },
  });
}

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
