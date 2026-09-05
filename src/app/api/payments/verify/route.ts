import { NextRequest } from "next/server";
import { ok, withApiHandler } from "@/lib/api-response";
import { paymentsVerifyQuerySchema } from "@/lib/validation";
import { verifyTransaction, applyPaystackOutcome } from "@/lib/payments";
import { enforceRateLimit, clientIp } from "@/lib/rateLimit";
import { notFound } from "@/lib/errors";

/**
 * Server-side verification — the frontend's Paystack popup "onSuccess"
 * callback triggers this call, but this route is what actually decides
 * anything (Section 17). Shares applyPaystackOutcome with the webhook
 * route so the two can never disagree about what a given reference means.
 *
 * Unauthenticated by necessity (a guest resuming payment on a public
 * order page has no session), so it is throttled per-IP and per-reference:
 * references are unguessable UUIDs, but the rate limit stops this being a
 * free way to burn our Paystack Verify quota or function budget.
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const { reference } = paymentsVerifyQuerySchema.parse({ reference: searchParams.get("reference") });

  await enforceRateLimit({ key: `payment_verify:${clientIp(req)}`, max: 30 });
  await enforceRateLimit({ key: `payment_verify_ref:${reference}`, max: 10 });

  const verification = await verifyTransaction(reference);
  const result = await applyPaystackOutcome(verification);

  if (!result.found) throw notFound("Payment reference");

  return ok({
    orderStatus: result.orderStatus,
    paymentStatus: result.paymentStatus,
    amountMismatch: result.amountMismatch,
  });
});
