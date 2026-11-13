import { createHash, timingSafeEqual } from "node:crypto";
import { json, readJson, route } from "@/server/http/api";
import { PAYMENT_ENABLED } from "@/domain/access";
import { Problem } from "@/lib/errors";
import { recordTransfer } from "@/server/payments";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

function digest(s: string) {
  return createHash("sha256").update(s).digest();
}

/** SePay sends `Authorization: Apikey <key>` with the key configured on its webhook. */
function authorized(header: string | null): boolean {
  const key = process.env.SEPAY_WEBHOOK_KEY?.trim();
  if (!key || !header) return false;
  const given = header.replace(/^(Apikey|Bearer)\s+/i, "").trim();
  return timingSafeEqual(digest(given), digest(key));
}

/** Bank transfer notifications from SePay (https://docs.sepay.vn/tich-hop-webhooks.html). */
export const POST = route(async (req) => {
  if (!PAYMENT_ENABLED) throw new Problem("Not found", 404);
  if (!authorized(req.headers.get("authorization"))) throw new Problem("Unauthorized", 401);
  const body = await readJson(req);
  const amount = Number(body.transferAmount);
  if (body.transferType !== "in" || !Number.isFinite(amount) || amount <= 0) return json({ success: true, outcome: "ignored" });
  if (body.id === undefined || body.id === null) throw new Problem("Thiếu id giao dịch.");
  const outcome = await recordTransfer({
    id: `sepay:${String(body.id)}`,
    amount: Math.round(amount),
    content: [body.code, body.content, body.description].filter((s) => typeof s === "string").join(" "),
    reference: typeof body.referenceCode === "string" ? body.referenceCode : null,
    raw: body as Prisma.InputJsonValue,
  });
  return json({ success: true, outcome });
});
