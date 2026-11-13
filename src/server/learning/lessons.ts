import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { canStudyDay } from "@/domain/access";
import { fallbackLesson, normalizeLesson } from "@/domain/content";
import { CURRICULUM_LEVEL, curriculumMeta, isModuleRef, renderLesson } from "@/domain/curriculum";
import { buildReviewLesson, isReviewDay, reviewSources, type ReviewSource } from "@/domain/curriculum/review";
import { isLightPace, lightenLesson } from "@/domain/pace";
import { profileLabels } from "@/domain/profile";
import { shiftLevel } from "@/domain/profile-options";
import type { AttemptView, LearnerProfile, Lesson, LevelId, StudyPlan, Summary } from "@/domain/types";
import { AIError, Problem } from "@/lib/errors";
import { vnDate } from "@/lib/time";
import { adaptDay, type RecentSession } from "@/server/ai/adapt";
import { isDemo } from "@/server/ai/config";
import { generateLesson, type DayTarget } from "@/server/ai/lesson";
import type { SessionUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { openAllDaysFor, toPracticeView } from "./practice";
import { logUsage, sha256, tryReserve } from "./usage";

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
  const openAll = openAllDaysFor(user);
  if (openAll && requestedDay && Number.isInteger(requestedDay) && requestedDay >= 1 && requestedDay <= 30) {
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
  if (last && (!last.completed || (!openAll && last.localDate === today) || last.day >= 30)) {
    return toAttemptView(last, !openAll && last.completed && last.day < 30 && !canStudyDay(user, last.day + 1));
  }
  const day = last ? last.day + 1 : 1;
  if (last && !openAll && !canStudyDay(user, day)) return toAttemptView(last, true);
  return openDay(user, day);
}

async function openDay(user: SessionUser, day: number): Promise<AttemptView> {
  const today = vnDate();
  const selected = await selectDay(user, day);
  const { choice, planned, key } = selected;
  const lesson = isLightPace(user.profile) ? lightenLesson(selected.lesson, day) : selected.lesson;
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
