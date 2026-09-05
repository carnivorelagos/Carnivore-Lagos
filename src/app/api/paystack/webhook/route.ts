import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, parseWebhookEvent } from "@/lib/paystack";
import { applyPaystackOutcome } from "@/lib/payments";
import { logger } from "@/lib/logger";

/**
 * Only `charge.success` and its failure counterparts move state; every
 * other Paystack event type (transfers, subscriptions, refunds — none of
 * which this MVP uses) is acknowledged and ignored. Always returns 200
 * once the signature checks out, per Paystack's own guidance to
 * acknowledge fast rather than let a slow handler cause a retry storm —
 * applyPaystackOutcome's writes are all fast, single-transaction
 * operations, comfortably inside Netlify's function time budget.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    logger.warn("webhook_signature_invalid", {});
    return NextResponse.json({ received: false }, { status: 401 });
  }

  const parsed = parseWebhookEvent(rawBody);
  if (!parsed) {
    logger.warn("webhook_payload_unparseable", {});
    return NextResponse.json({ received: true }, { status: 200 });
  }

  logger.info("webhook_received", { event: parsed.event, reference: parsed.verify.reference });

  if (parsed.event !== "charge.success" && parsed.verify.outcome === "pending") {
    // Not an event we act on (e.g. transfer.success) — acknowledge and skip.
    return NextResponse.json({ received: true }, { status: 200 });
  }

  try {
    const result = await applyPaystackOutcome(parsed.verify);
    if (!result.found) {
      // Superseded or unknown reference — safe no-op, not an error
      // (Section 18/45).
      logger.info("webhook_reference_not_found", { reference: parsed.verify.reference });
    }
  } catch (err) {
    // Even on an unexpected DB error we still want Paystack to retry —
    // returning non-200 here is what triggers their retry schedule, which
    // is exactly the recovery path Section 19 relies on for "DB
    // unavailable for 30s".
    logger.error("webhook_processing_failed", {
      reference: parsed.verify.reference,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ received: false }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
