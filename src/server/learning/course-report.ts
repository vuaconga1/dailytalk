import "server-only";
import { normalizeLesson } from "@/domain/content";
import { buildCourseReport, courseLength, type CourseReport } from "@/domain/course-report";
import type { Summary } from "@/domain/types";
import type { SessionUser } from "@/server/auth";
import { prisma } from "@/server/db";

/** Whole-course statistics, built once the learner has completed the last day of their course. */
export async function getCourseReport(user: SessionUser): Promise<CourseReport | null> {
  if (!user.profile) return null;
  const [rows, studyTimes, shadowing] = await Promise.all([
    prisma.attempt.findMany({
      where: { userId: user.id },
      select: { day: true, localDate: true, lesson: true, summary: true, completed: true },
    }),
    prisma.studyTime.findMany({ where: { userId: user.id }, select: { localDate: true, seconds: true } }),
    prisma.shadowingAttempt.aggregate({
      where: { userId: user.id },
      _count: true,
      _avg: { score: true },
      _max: { score: true },
    }),
  ]);
  return buildCourseReport({
    rows: rows.map((r) => ({ ...r, lesson: normalizeLesson(r.lesson), summary: r.summary as Summary | null })),
    totalDays: courseLength(user.plan),
    studyTimes,
    startLevel: user.profile.classification.level,
    endLevel: user.profile.working_level,
    shadowing: {
      attempts: shadowing._count,
      avgScore: shadowing._avg.score === null ? null : Math.round(shadowing._avg.score),
      bestScore: shadowing._max.score,
    },
  });
}
