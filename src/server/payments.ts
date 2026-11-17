import "server-only";
import { randomInt } from "node:crypto";
import { Prisma, type Payment } from "@/generated/prisma/client";
import {
  formatVnd,
  packageNameOf,
  PAYMENT_CODE_PATTERN,
  PAYMENT_CODE_PREFIX,
  planOf,
  type PlanId,
  type PaymentView,
  type ReminderChannel,
} from "@/domain/payment";
import { Problem } from "@/lib/errors";
import { vnDate } from "@/lib/time";
import { prisma } from "@/server/db";
import { appUrl } from "@/server/jobs";
import { notify } from "@/server/notify";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DAY_MS = 86_400_000;

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

/** Receiving account; the QR is only shown once bank, account number and holder name are set. */
function bankConfig() {
  const bankId = env("PAYMENT_BANK_ID");
  const accountNo = env("PAYMENT_ACCOUNT_NO");
  const accountName = env("PAYMENT_ACCOUNT_NAME");
  if (!bankId || !accountNo || !accountName) return null;
  return { bankId, accountNo, accountName, name: env("PAYMENT_BANK_NAME") || bankId };
}

/** VietQR (NAPAS 247) image: banking apps fill in account, amount and message when scanned. */
function qrUrl(bank: NonNullable<ReturnType<typeof bankConfig>>, p: Pick<Payment, "amount" | "code">): string {
  const params = new URLSearchParams({ amount: String(p.amount), addInfo: p.code, accountName: bank.accountName });
  return `https://img.vietqr.io/image/${encodeURIComponent(bank.bankId)}-${encodeURIComponent(bank.accountNo)}-compact2.png?${params}`;
}

function asPlanId(value: string): PlanId {
  return value === "email" ? "email" : "full";
}

export function toPaymentView(p: Payment): PaymentView {
  const bank = bankConfig();
  const plan = planOf(p.planId);
  const planId = asPlanId(p.planId);
  return {
    code: p.code,
    planId,
    days: p.days,
    amount: p.amount,
    channels: plan?.channels ?? (planId === "full" ? (["email", "zalo"] as ReminderChannel[]) : (["email"] as ReminderChannel[])),
    status: p.status,
    qrUrl: bank ? qrUrl(bank, p) : null,
    bank: bank && { name: bank.name, accountNo: bank.accountNo, accountName: bank.accountName },
  };
}

function newCode(): string {
  let code = PAYMENT_CODE_PREFIX;
  for (let i = 0; i < 8; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** Reuses the learner's unpaid order for the same plan, so re-opening the page keeps the same QR. */
export async function openPayment(userId: string, planId: unknown): Promise<Payment> {
  const plan = planOf(planId);
  if (!plan) throw new Problem("Gói học không hợp lệ.");
  const pending = await prisma.payment.findFirst({
    where: { userId, planId: plan.id, amount: plan.amount, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  if (pending) return pending;
  for (let i = 0; ; i++) {
    try {
      return await prisma.payment.create({
        data: { userId, code: newCode(), planId: plan.id, days: plan.days, amount: plan.amount },
      });
    } catch (error) {
      const duplicate = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!duplicate || i >= 3) throw error;
    }
  }
}

export async function findPayment(userId: string, code: unknown): Promise<Payment> {
  const payment =
    typeof code === "string" && code ? await prisma.payment.findFirst({ where: { userId, code: code.toUpperCase() } }) : null;
  if (!payment) throw new Problem("Không tìm thấy giao dịch.", 404);
  return payment;
}

export type IncomingTransfer = { id: string; amount: number; content: string; reference: string | null; raw: Prisma.InputJsonValue };

export type TransferOutcome = "duplicate" | "unmatched" | "partial" | "paid" | "already_paid";

/**
 * Records a bank transfer once and matches it to an order by the code in its message.
 * When the order's transfers cover its amount, the learner's package is activated (or extended).
 */
export async function recordTransfer(t: IncomingTransfer): Promise<TransferOutcome> {
  const code = t.content.match(PAYMENT_CODE_PATTERN)?.[0].toUpperCase();
  const now = new Date();
  let activated: { userId: string; name: string } | null = null;
  let outcome: TransferOutcome;
  try {
    outcome = await prisma.$transaction(async (tx) => {
      const payment = code ? await tx.payment.findUnique({ where: { code } }) : null;
      await tx.bankTransfer.create({
        data: { id: t.id, paymentId: payment?.id, amount: t.amount, content: t.content, reference: t.reference, raw: t.raw },
      });
      if (!payment) return "unmatched";
      if (payment.status === "PAID") return "already_paid";
      const { _sum } = await tx.bankTransfer.aggregate({ where: { paymentId: payment.id }, _sum: { amount: true } });
      if ((_sum.amount ?? 0) < payment.amount) return "partial";

      const { count } = await tx.payment.updateMany({ where: { id: payment.id, status: "PENDING" }, data: { status: "PAID", paidAt: now } });
      if (!count) return "already_paid";
      const user = await tx.user.findUniqueOrThrow({
        where: { id: payment.userId },
        select: { id: true, name: true, status: true, accessEndsAt: true, activatedAt: true },
      });
      // Paying while a package is still running extends it; an account without an end date stays unlimited.
      const running = user.status === "ACTIVE" && (!user.accessEndsAt || user.accessEndsAt > now);
      const from = running && user.accessEndsAt ? user.accessEndsAt : now;
      const plan = planOf(payment.planId);
      const planId = asPlanId(payment.planId);
      const packageName = packageNameOf(planId);
      const channels = plan?.channels ?? (planId === "full" ? ["email", "zalo"] : ["email"]);
      await tx.user.update({
        where: { id: user.id },
        data: {
          status: "ACTIVE",
          packageName,
          reminderChannels: channels,
          activatedAt: user.activatedAt ?? now,
          accessEndsAt: running && !user.accessEndsAt ? null : new Date(from.getTime() + payment.days * DAY_MS),
          lockAt: null,
        },
      });
      await tx.staffNote.create({
        data: {
          learnerId: user.id,
          body: `Thanh toán QR ${formatVnd(payment.amount)} (mã ${payment.code}), tự động kích hoạt ${packageName}.`,
        },
      });
      activated = { userId: user.id, name: user.name };
      return "paid";
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "duplicate";
    throw error;
  }
  if (activated) {
    const { userId, name } = activated as { userId: string; name: string };
    await notify(
      userId,
      "activated",
      vnDate(),
      `Cảm ơn ${name}! WeWIN đã nhận thanh toán và kích hoạt lộ trình Daily Speaking của bạn. Mỗi ngày 15 phút, học tiếp tại: ${appUrl()}/today`,
    ).catch((error: unknown) => console.error("payment notify", error));
  }
  return outcome;
}
