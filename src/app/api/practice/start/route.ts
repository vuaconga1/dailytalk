import { authedRoute, json, readJson } from "@/lib/api";
import { Problem } from "@/lib/errors";
import { DAILY_SECONDS, OPEN_ALL_DAYS, ownedAttempt, toPracticeView } from "@/lib/learning";
import { prisma } from "@/lib/prisma";
import { vnDayStart, vnNextMidnight } from "@/lib/time";
import { normalizeLesson } from "@/lib/content";

export const POST = authedRoute(async (req, user) => {
  const attempt = await ownedAttempt(user, (await readJson(req)).attempt_id);
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

  const now = Date.now();
  const deadline = Math.min(now + DAILY_SECONDS * 1000, vnNextMidnight(now).getTime());
  const opening = normalizeLesson(attempt.lesson).roleplay.opening;
  const practice = await prisma.practice
    .create({
      data: {
        attemptId: attempt.id,
        userId: user.id,
        startedAt: new Date(now),
        deadline: new Date(deadline),
        turns: [{ role: "assistant", text: opening }],
      },
    })
    .catch(async (error: unknown) => {
      // Two tabs started at once: return the session the other request created.
      if ((error as { code?: string }).code !== "P2002") throw error;
      return prisma.practice.findUniqueOrThrow({ where: { attemptId: attempt.id } });
    });
  return json({ practice: toPracticeView(practice), serverTime: Date.now() });
});
