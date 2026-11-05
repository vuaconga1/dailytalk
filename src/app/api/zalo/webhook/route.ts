import type { NextRequest } from "next/server";
import { json, route } from "@/lib/api";
import { Problem } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { LINK_CODE_PATTERN, sendText, verifyWebhook } from "@/lib/zalo";

export const dynamic = "force-dynamic";

type ZaloEvent = {
  event_name?: string;
  timestamp?: string | number;
  sender?: { id?: string };
  follower?: { id?: string };
  message?: { text?: string };
};

async function touch(zaloUserId: string, data: { followed?: boolean } = {}) {
  await prisma.zaloLink.updateMany({ where: { zaloUserId }, data: { lastInteractionAt: new Date(), ...data } });
}

async function linkAccount(zaloUserId: string, text: string) {
  const code = text.match(LINK_CODE_PATTERN)?.[0].toUpperCase();
  if (!code) return false;
  const pending = await prisma.zaloLinkCode.findUnique({ where: { code } });
  if (!pending || pending.expiresAt < new Date()) {
    await sendText(zaloUserId, "Mã liên kết không đúng hoặc đã hết hạn. Hãy tạo mã mới trong mục Cài đặt của WeWIN Daily Speaking.");
    return true;
  }
  const user = await prisma.user.findUnique({ where: { id: pending.userId }, select: { name: true } });
  await prisma.$transaction([
    // One Zalo account ↔ one learner: relinking moves the connection.
    prisma.zaloLink.deleteMany({ where: { OR: [{ zaloUserId }, { userId: pending.userId }] } }),
    prisma.zaloLink.create({ data: { userId: pending.userId, zaloUserId, lastInteractionAt: new Date() } }),
    prisma.zaloLinkCode.delete({ where: { code } }),
  ]);
  await sendText(
    zaloUserId,
    `Đã liên kết tài khoản ${user?.name ?? ""} với WeWIN Daily Speaking. Bạn sẽ nhận nhắc học qua Zalo vào giờ học mỗi ngày.`,
  );
  return true;
}

/** Zalo OA webhook: follow / unfollow / learner messages (incl. account link codes). */
export const POST = route(async (req: NextRequest) => {
  const raw = await req.text();
  let event: ZaloEvent;
  try {
    event = JSON.parse(raw) as ZaloEvent;
  } catch {
    throw new Problem("JSON không hợp lệ.");
  }
  if (!verifyWebhook(raw, String(event.timestamp ?? ""), req.headers.get("x-zevent-signature"))) {
    throw new Problem("Chữ ký webhook không hợp lệ.", 401);
  }

  const name = event.event_name ?? "";
  if (name === "follow" && event.follower?.id) {
    await touch(event.follower.id, { followed: true });
    const linked = await prisma.zaloLink.count({ where: { zaloUserId: event.follower.id } });
    if (!linked) {
      await sendText(
        event.follower.id,
        "Chào bạn! Để nhận nhắc học, hãy gửi mã liên kết (dạng WWxxxxxx) trong mục Cài đặt của WeWIN Daily Speaking vào khung chat này.",
      );
    }
  } else if (name === "unfollow" && event.follower?.id) {
    await prisma.zaloLink.updateMany({ where: { zaloUserId: event.follower.id }, data: { followed: false } });
  } else if (name.startsWith("user_send") && event.sender?.id) {
    await touch(event.sender.id, { followed: true });
    if (name === "user_send_text") await linkAccount(event.sender.id, event.message?.text ?? "");
  }
  return json({ ok: true });
});
