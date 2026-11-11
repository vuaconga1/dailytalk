import "server-only";
import { vnDate } from "@/lib/time";
import { prisma } from "@/server/db";

/** A start older than this was abandoned; one study session never counts for more. */
const MAX_SESSION_MS = 2 * 60 * 60 * 1000;

/** Start/continue pressed on /today. Keeps a recent start so going back and forth does not reset the clock. */
export async function startStudy(attemptId: string): Promise<void> {
  const now = new Date();
  await prisma.attempt.updateMany({
    where: {
      id: attemptId,
      completed: false,
      OR: [{ studyStartedAt: null }, { studyStartedAt: { lt: new Date(now.getTime() - MAX_SESSION_MS) } }],
    },
    data: { studyStartedAt: now },
  });
}

/** Summary created: adds the time since start to today's total and clears the start. */
export async function finishStudy(userId: string, attemptId: string): Promise<void> {
  const attempt = await prisma.attempt.findUnique({ where: { id: attemptId }, select: { studyStartedAt: true } });
  const startedAt = attempt?.studyStartedAt;
  if (!startedAt) return;
  const { count } = await prisma.attempt.updateMany({
    where: { id: attemptId, studyStartedAt: startedAt },
    data: { studyStartedAt: null },
  });
  if (!count) return;
  const now = Date.now();
  const seconds = Math.round(Math.min(Math.max(now - startedAt.getTime(), 0), MAX_SESSION_MS) / 1000);
  if (!seconds) return;
  const localDate = vnDate(now);
  await prisma.studyTime.upsert({
    where: { userId_localDate: { userId, localDate } },
    create: { userId, localDate, seconds },
    update: { seconds: { increment: seconds } },
  });
}

/** Study seconds per month ("YYYY-MM"). */
export async function getMonthlyStudySeconds(userId: string): Promise<Record<string, number>> {
  const rows = await prisma.studyTime.findMany({ where: { userId }, select: { localDate: true, seconds: true } });
  const months: Record<string, number> = {};
  for (const r of rows) {
    const month = r.localDate.slice(0, 7);
    months[month] = (months[month] ?? 0) + r.seconds;
  }
  return months;
}
