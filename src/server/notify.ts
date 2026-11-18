import "server-only";
import { prisma } from "@/server/db";
import { reminderEmailHtml, sendEmail } from "@/server/integrations/email";
import { messagingWindowHours, sendText } from "@/server/integrations/zalo";

export type NotifyOutcome = "sent" | "skipped" | "failed" | "duplicate";

export type NotifyOptions = {
  /** Subject for email channel; defaults from kind. */
  emailSubject?: string;
  /** Body for email when it should differ from Zalo (e.g. no "reply OK"). */
  emailText?: string;
  /** CTA link embedded in the HTML email. */
  emailCtaUrl?: string;
};

/**
 * Queues one message per (user, kind, localDate) and delivers it right away.
 * Re-running a job never sends the same reminder twice.
 * Delivers to each channel unlocked on the learner's paid plan (email and/or Zalo).
 * Empty reminderChannels = legacy accounts keep Zalo-only behavior.
 */
export async function notify(
  userId: string,
  kind: string,
  localDate: string,
  text: string,
  options: NotifyOptions = {},
): Promise<NotifyOutcome> {
  const { count } = await prisma.notification.createMany({
    data: [{ userId, kind, localDate, text }],
    skipDuplicates: true,
  });
  if (!count) return "duplicate";
  return deliver(userId, kind, localDate, text, options);
}

async function finish(userId: string, kind: string, localDate: string, data: object) {
  await prisma.notification.update({
    where: { userId_kind_localDate: { userId, kind, localDate } },
    data: { attempts: { increment: 1 }, ...data },
  });
}

function defaultEmailSubject(kind: string): string {
  if (kind === "study_reminder") return "Đến giờ học WeWIN Daily Speaking";
  if (kind === "activated") return "Lộ trình Daily Speaking đã được kích hoạt";
  return "Thông báo từ WeWIN Daily Speaking";
}

type ChannelResult = { channel: string; outcome: "sent" | "skipped" | "failed"; detail: string };

async function deliverEmail(
  to: string,
  kind: string,
  text: string,
  options: NotifyOptions,
): Promise<ChannelResult> {
  const subject = options.emailSubject ?? defaultEmailSubject(kind);
  const body = options.emailText ?? text;
  const html = reminderEmailHtml(body, options.emailCtaUrl);
  const result = await sendEmail({ to, subject, text: body, html });
  if (result.ok) return { channel: "email", outcome: "sent", detail: result.id };
  if (result.dryRun) return { channel: "email", outcome: "skipped", detail: result.reason };
  return { channel: "email", outcome: "failed", detail: result.reason };
}

async function deliverZalo(userId: string, text: string): Promise<ChannelResult> {
  const link = await prisma.zaloLink.findUnique({ where: { userId } });
  if (!link) return { channel: "zalo_oa", outcome: "skipped", detail: "Học viên chưa liên kết Zalo OA" };
  if (!link.followed) return { channel: "zalo_oa", outcome: "skipped", detail: "Học viên đã bỏ quan tâm OA" };
  const windowStart = Date.now() - messagingWindowHours() * 3_600_000;
  if (!link.lastInteractionAt || link.lastInteractionAt.getTime() < windowStart) {
    return {
      channel: "zalo_oa",
      outcome: "skipped",
      detail: `Quá ${messagingWindowHours()} giờ kể từ lần tương tác cuối – cần học viên nhắn OA`,
    };
  }
  try {
    const result = await sendText(link.zaloUserId, text);
    if (result.ok) return { channel: "zalo_oa", outcome: "sent", detail: "ok" };
    if (result.dryRun) return { channel: "zalo_oa", outcome: "skipped", detail: result.reason };
    return { channel: "zalo_oa", outcome: "failed", detail: result.reason };
  } catch (error) {
    return { channel: "zalo_oa", outcome: "failed", detail: String(error).slice(0, 300) };
  }
}

async function deliver(
  userId: string,
  kind: string,
  localDate: string,
  text: string,
  options: NotifyOptions,
): Promise<NotifyOutcome> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, reminderChannels: true, isDemo: true },
  });

  const channels = user?.reminderChannels ?? [];
  // Empty = legacy / admin-activated accounts keep prior Zalo-only behavior.
  const wantZalo = channels.length === 0 || channels.includes("zalo");
  const wantEmail = channels.includes("email");

  if (!wantZalo && !wantEmail) {
    await finish(userId, kind, localDate, { status: "SKIPPED", reason: "Gói chưa mở kênh nhắc", channel: "none" });
    return "skipped";
  }

  const results: ChannelResult[] = [];
  if (wantEmail && user && !user.isDemo) {
    results.push(await deliverEmail(user.email, kind, text, options));
  } else if (wantEmail) {
    results.push({ channel: "email", outcome: "skipped", detail: "Tài khoản demo" });
  }
  if (wantZalo) results.push(await deliverZalo(userId, text));

  const sent = results.filter((r) => r.outcome === "sent");
  const failed = results.filter((r) => r.outcome === "failed");
  const channelLabel = results.map((r) => r.channel).join("+") || "none";
  const reason = results.map((r) => `${r.channel}: ${r.outcome}${r.detail ? ` (${r.detail})` : ""}`).join(" · ").slice(0, 500);

  if (sent.length > 0) {
    await finish(userId, kind, localDate, { status: "SENT", sentAt: new Date(), reason, channel: channelLabel });
    return "sent";
  }
  if (failed.length > 0) {
    await finish(userId, kind, localDate, { status: "FAILED", reason, channel: channelLabel });
    return "failed";
  }
  await finish(userId, kind, localDate, { status: "SKIPPED", reason, channel: channelLabel });
  return "skipped";
}
