import "server-only";
import type { Practice, Prisma } from "@/generated/prisma/client";
import { canStudyDay, isTrial } from "@/domain/access";
import type { PracticeView, Turn } from "@/domain/types";
import { Problem } from "@/lib/errors";
import type { SessionUser } from "@/server/auth";
import { prisma } from "@/server/db";

export const DAILY_SECONDS = 180;
export const MAX_TURNS = 20;
/** Testing switch (on unless OPEN_ALL_DAYS=false): every plan day is open, in any order, repeatable, with no daily limits. */
export const OPEN_ALL_DAYS = process.env.OPEN_ALL_DAYS?.trim() !== "false";

/** The testing switch never opens paid days to a trial learner. */
export function openAllDaysFor(user: Pick<SessionUser, "isDemo" | "status">): boolean {
  return OPEN_ALL_DAYS && !isTrial(user);
}
/** A crashed request must not lock a practice session forever. */
const STALE_LOCK_MS = 90_000;
/** Speech recorded right up to the deadline is uploaded, transcribed and saved after it. */
export const LATE_TURN_MS = 30_000;

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
  if (requireAccess && !openAllDaysFor(user) && !canStudyDay(user, attempt.day)) {
    throw new Problem(
      isTrial(user)
        ? "Buổi học thử đã kết thúc. Hãy thanh toán gói học để mở toàn bộ lộ trình."
        : "Tài khoản chưa được kích hoạt hoặc đã hết hạn. Vui lòng liên hệ chuyên viên WeWIN.",
      403,
    );
  }
  return attempt;
}

function unlockedSince(now: Date): Prisma.PracticeWhereInput {
  return {
    OR: [{ busySince: null }, { busySince: { lt: new Date(now.getTime() - STALE_LOCK_MS) } }],
  };
}

/** Writes the session's turns and releases the lock in one query. */
export type SaveTurns = (turns: Turn[]) => Promise<void>;

/** Runs `fn` while holding the session's AI lock; one provider call per session at a time. */
export async function withPracticeLock<T>(
  userId: string,
  practiceId: unknown,
  fn: (p: Practice, save: SaveTurns) => Promise<T>,
  graceMs = 0,
): Promise<T> {
  if (typeof practiceId !== "string" || !practiceId) throw new Problem("Không tìm thấy phiên luyện tập.", 404);
  const now = new Date();
  const [locked] = await prisma.practice.updateManyAndReturn({
    where: {
      id: practiceId,
      userId,
      ended: false,
      deadline: { gt: new Date(now.getTime() - graceMs) },
      ...unlockedSince(now),
    },
    data: { busySince: now },
  });
  if (!locked) {
    const p = await prisma.practice.findFirst({
      where: { id: practiceId, userId },
    });
    if (!p) throw new Problem("Không tìm thấy phiên luyện tập.", 404);
    if (p.ended || p.deadline.getTime() <= now.getTime() - graceMs) throw new Problem("Đã hết 3 phút hội thoại. Hãy xem tổng kết.", 409);
    throw new Problem("AI đang xử lý lượt trước. Vui lòng chờ.", 409);
  }
  let released = false;
  const save: SaveTurns = async (turns) => {
    await prisma.practice.updateMany({
      where: { id: practiceId, busySince: now },
      data: { turns, busySince: null },
    });
    released = true;
  };
  try {
    return await fn(locked, save);
  } finally {
    if (!released) {
      await prisma.practice.updateMany({
        where: { id: practiceId, busySince: now },
        data: { busySince: null },
      });
    }
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
