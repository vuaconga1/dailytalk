import "server-only";
import { createHash } from "node:crypto";
import { after } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { Problem } from "@/lib/errors";
import { vnDayStart } from "@/lib/time";
import { aiConfig, isDemo } from "@/server/ai/config";
import { prisma } from "@/server/db";
import { OPEN_ALL_DAYS } from "./practice";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Reserves an AI call; false (use the rule-based path) when today's quota is used up. */
export async function tryReserve(userId: string, kind: string): Promise<boolean> {
  if (isDemo) return false;
  try {
    await reserveProviderCall(userId, kind);
    return true;
  } catch (error) {
    if (!(error instanceof Problem)) throw error;
    return false;
  }
}

export async function logUsage(userId: string, kind: string, data: object, model: string | null = aiConfig.model) {
  await prisma.usage.create({
    data: { userId, kind, model, data: data as Prisma.InputJsonValue },
  });
}

/** Writes the usage row after the response is sent; only callable while handling a request. */
export function logUsageLater(userId: string, kind: string, data: object, model: string | null = aiConfig.model) {
  after(() => logUsage(userId, kind, data, model).catch((e) => console.error("Usage log failed:", e)));
}

/**
 * Reserve BEFORE network I/O. Failures count too, limiting costly retries.
 * `defer` (request handlers only) skips the wait when there is no daily limit to enforce.
 */
export async function reserveProviderCall(userId: string, kind: string, defer = false) {
  if (isDemo) return;
  if (OPEN_ALL_DAYS) {
    if (defer) return logUsageLater(userId, `reserve_${kind}`, {});
    return logUsage(userId, `reserve_${kind}`, {});
  }
  const since = vnDayStart();
  const limit = Number(process.env.MAX_PROVIDER_CALLS_PER_USER_DAY ?? 90);
  const count = await prisma.usage.count({
    where: {
      userId,
      kind: { startsWith: "reserve_" },
      createdAt: { gte: since },
    },
  });
  if (count >= limit) throw new Problem("Đã đạt hạn mức yêu cầu AI trong ngày.", 429);
  await logUsage(userId, `reserve_${kind}`, {});
}
