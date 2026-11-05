import { authedRoute, json } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { LINK_CODE_TTL_MS, newLinkCode, oaFollowUrl, zaloConfigured } from "@/lib/zalo";

async function status(userId: string) {
  const link = await prisma.zaloLink.findUnique({ where: { userId } });
  return {
    configured: zaloConfigured(),
    oaUrl: oaFollowUrl(),
    linked: Boolean(link),
    followed: link?.followed ?? false,
    linkedAt: link?.linkedAt ?? null,
    lastInteractionAt: link?.lastInteractionAt ?? null,
  };
}

export const GET = authedRoute(async (_req, user) => json(await status(user.id)));

/** Issues a fresh code the learner sends to the OA chat. */
export const POST = authedRoute(async (_req, user) => {
  const code = newLinkCode();
  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS);
  await prisma.$transaction([
    prisma.zaloLinkCode.deleteMany({ where: { OR: [{ userId: user.id }, { expiresAt: { lt: new Date() } }] } }),
    prisma.zaloLinkCode.create({ data: { code, userId: user.id, expiresAt } }),
  ]);
  return json({ code, expiresAt, ...(await status(user.id)) });
});

export const DELETE = authedRoute(async (_req, user) => {
  await prisma.zaloLink.deleteMany({ where: { userId: user.id } });
  return json(await status(user.id));
});
