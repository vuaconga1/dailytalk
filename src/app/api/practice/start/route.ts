import { authedRoute, json, readJson } from "@/server/http/api";
import { Problem } from "@/lib/errors";
import { DAILY_SECONDS, OPEN_ALL_DAYS, ownedAttempt, toPracticeView } from "@/server/learning/practice";
import { prisma } from "@/server/db";
import { vnDayStart, vnNextMidnight } from "@/lib/time";
import { normalizeLesson } from "@/domain/content";
import { Prisma } from "@/generated/prisma/client";

export const POST = authedRoute(async (req, user) => {
  const attempt = await ownedAttempt(user, (await readJson(req)).attempt_id);
  const now = Date.now();
  const opening = normalizeLesson(attempt.lesson).roleplay.opening;
  const fresh = { turns: [{ role: "assistant", text: opening }] as Prisma.InputJsonValue, ended: false, busySince: null };

  if (OPEN_ALL_DAYS && attempt.practice && (attempt.completed || attempt.practice.ended || attempt.practice.deadline.getTime() <= now)) {
    const [, practice] = await prisma.$transaction([
      prisma.attempt.update({ where: { id: attempt.id }, data: { completed: false, summary: Prisma.DbNull } }),
      prisma.practice.update({
        where: { id: attempt.practice.id },
        data: { ...fresh, startedAt: new Date(now), deadline: new Date(now + DAILY_SECONDS * 1000) },
      }),
    ]);
    return json({ practice: toPracticeView(practice), serverTime: Date.now() });
  }

  if (attempt.completed) throw new Problem("Buổi học đã hoàn thành.", 409);
  if (attempt.practice) return json({ practice: toPracticeView(attempt.practice), serverTime: Date.now() });

  // One allocation per learner per calendar day, even on stale attempts.
  const usedToday =
    !OPEN_ALL_DAYS &&
    (await prisma.practice.findFirst({
      where: { userId: user.id, startedAt: { gte: vnDayStart() } },
      select: { id: true },
    }));
  if (usedToday) throw new Problem("Hôm nay đã cấp phiên 3 phút.", 409);

  const deadline = OPEN_ALL_DAYS ? now + DAILY_SECONDS * 1000 : Math.min(now + DAILY_SECONDS * 1000, vnNextMidnight(now).getTime());
  const practice = await prisma.practice
    .create({
      data: {
        attemptId: attempt.id,
        userId: user.id,
        startedAt: new Date(now),
        deadline: new Date(deadline),
        turns: fresh.turns,
      },
    })
    .catch(async (error: unknown) => {
      // Two tabs started at once: return the session the other request created.
      if ((error as { code?: string }).code !== "P2002") throw error;
      return prisma.practice.findUniqueOrThrow({ where: { attemptId: attempt.id } });
    });
  return json({ practice: toPracticeView(practice), serverTime: Date.now() });
});
