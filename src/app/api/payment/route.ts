import { authedRoute, json, readJson } from "@/server/http/api";
import { PAYMENT_ENABLED } from "@/domain/access";
import { Problem } from "@/lib/errors";
import { findPayment, openPayment, toPaymentView } from "@/server/payments";

function requireEnabled() {
  if (!PAYMENT_ENABLED) throw new Problem("Not found", 404);
}

/** Opens (or reuses) the QR transfer order for a plan: `{ months }`. */
export const POST = authedRoute(async (req, user) => {
  requireEnabled();
  const body = await readJson(req);
  return json(toPaymentView(await openPayment(user.id, body.months)));
});

/** Polled by the payment page until the bank webhook marks the order paid. */
export const GET = authedRoute(async (req, user) => {
  requireEnabled();
  return json(toPaymentView(await findPayment(user.id, req.nextUrl.searchParams.get("code"))));
});
