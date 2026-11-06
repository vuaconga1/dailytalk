import "server-only";
import { prisma } from "@/server/db";
import { messagingWindowHours, sendText } from "@/server/integrations/zalo";

export type NotifyOutcome = "sent" | "skipped" | "failed" | "duplicate";

/**
 * Queues one message per (user, kind, localDate) and delivers it right away.
 * Re-running a job never sends the same reminder twice.
 */
export async function notify(userId: string, kind: string, localDate: string, text: string): Promise<NotifyOutcome> {
  const { count } = await prisma.notification.createMany({
    data: [{ userId, kind, localDate, text }],
    skipDuplicates: true,
  });
  if (!count) return "duplicate";
  return deliver(userId, kind, localDate, text);
}

async function finish(userId: string, kind: string, localDate: string, data: object) {
  await prisma.notification.update({
    where: { userId_kind_localDate: { userId, kind, localDate } },
    data: { attempts: { increment: 1 }, ...data },
  });
}

async function deliver(userId: string, kind: string, localDate: string, text: string): Promise<NotifyOutcome> {
  const link = await prisma.zaloLink.findUnique({ where: { userId } });
  const skip = async (reason: string) => {
    await finish(userId, kind, localDate, { status: "SKIPPED", reason });
    return "skipped" as const;
  };
  if (!link) return skip("Học viên chưa liên kết Zalo OA");
  if (!link.followed) return skip("Học viên đã bỏ quan tâm OA");
  const windowStart = Date.now() - messagingWindowHours() * 3_600_000;
  if (!link.lastInteractionAt || link.lastInteractionAt.getTime() < windowStart) {
    return skip(`Quá ${messagingWindowHours()} giờ kể từ lần tương tác cuối – cần học viên nhắn OA`);
  }
  try {
    const result = await sendText(link.zaloUserId, text);
    if (result.ok) {
      await finish(userId, kind, localDate, { status: "SENT", sentAt: new Date(), reason: null });
      return "sent";
    }
    if (result.dryRun) return skip(result.reason);
    await finish(userId, kind, localDate, { status: "FAILED", reason: result.reason });
    return "failed";
  } catch (error) {
    await finish(userId, kind, localDate, { status: "FAILED", reason: String(error).slice(0, 300) });
    return "failed";
  }
}
