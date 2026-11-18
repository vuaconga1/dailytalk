import { authedRoute, json } from "@/server/http/api";
import { Problem } from "@/lib/errors";
import { zaloReminderEligible } from "@/domain/payment";
import { prisma } from "@/server/db";
import { LINK_CODE_TTL_MS, newLinkCode, oaFollowUrl, zaloConfigured } from "@/server/integrations/zalo";

async function status(userId: string, channels: string[]) {
  const link = await prisma.zaloLink.findUnique({ where: { userId } });
  return {
    configured: zaloConfigured(),
    oaUrl: oaFollowUrl(),
    linked: Boolean(link),
    followed: link?.followed ?? false,
    linkedAt: link?.linkedAt ?? null,
    lastInteractionAt: link?.lastInteractionAt ?? null,
    eligible: zaloReminderEligible(channels),
  };
}

export const GET = authedRoute(async (_req, user) => json(await status(user.id, user.reminderChannels)));

/** Issues a fresh code the learner sends to the OA chat. */
export const POST = authedRoute(async (_req, user) => {
  if (!zaloReminderEligible(user.reminderChannels)) {
    throw new Problem("Gói hiện tại chưa mở nhắc học qua Zalo. Hãy nâng lên gói email + Zalo.", 403);
  }
  const code = newLinkCode();
  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS);
  await prisma.$transaction([
    prisma.zaloLinkCode.deleteMany({ where: { OR: [{ userId: user.id }, { expiresAt: { lt: new Date() } }] } }),
    prisma.zaloLinkCode.create({ data: { code, userId: user.id, expiresAt } }),
  ]);
  return json({ code, expiresAt, ...(await status(user.id, user.reminderChannels)) });
});

export const DELETE = authedRoute(async (_req, user) => {
  await prisma.zaloLink.deleteMany({ where: { userId: user.id } });
  return json(await status(user.id, user.reminderChannels));
});
