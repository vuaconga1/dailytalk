import "server-only";
import type { Practice, Prisma } from "@/generated/prisma/client";
import { canStudyDay } from "@/domain/access";
import type { PracticeView, Turn } from "@/domain/types";
import { Problem } from "@/lib/errors";
import type { SessionUser } from "@/server/auth";
import { prisma } from "@/server/db";

export const DAILY_SECONDS = 180;
export const MAX_TURNS = 20;
/** Testing switch (on unless OPEN_ALL_DAYS=false): every plan day is open, in any order, repeatable, with no daily limits. */
export const OPEN_ALL_DAYS = process.env.OPEN_ALL_DAYS?.trim() !== "false";
/** A crashed request must not lock a practice session forever. */
const STALE_LOCK_MS = 90_000;

export function toPracticeView(p: Practice): PracticeView {
  return {
    id: p.id,
    deadline: p.deadline.getTime(),
    ended: p.ended,
    turns: p.turns as Turn[],
  };
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
  if (requireAccess && !OPEN_ALL_DAYS && !canStudyDay(user, attempt.day)) {
    throw new Problem("Tài khoản chưa được kích hoạt hoặc đã hết hạn. Vui lòng liên hệ chuyên viên WeWIN.", 403);
  }
  return attempt;
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
