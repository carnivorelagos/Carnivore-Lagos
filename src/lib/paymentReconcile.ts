import { prisma } from "./prisma";
import { verifyTransaction, applyPaystackOutcome } from "./payments";
import { recordPaymentIssue, autoResolvePaymentIssue } from "./paymentIssues";
import { logger } from "./logger";

/**
 * Stuck-payment reconciliation. Runs on a schedule
 * (netlify/functions/reconcile-payments.mts → POST
 * /api/internal/reconcile-payments) and can also be run by hand.
 *
 * It exists because Paystack webhook retries eventually give up, and a
 * customer who never returns to the tab never triggers the verify route —
 * so a genuinely-successful payment can otherwise sit unnoticed with its
 * order stuck at PENDING_PAYMENT.
 */

// Only re-check a PENDING payment once it's had time to resolve on its own.
const STALE_AFTER_MS = 15 * 60 * 1000; // 15 minutes
// Past this, a still-PENDING payment is escalated to a PaymentIssue.
const ESCALATE_AFTER_MS = 6 * 60 * 60 * 1000; // 6 hours
// Cap the batch so the function stays well inside Netlify's time budget.
const MAX_BATCH = 50;

export type ReconcileSummary = {
  checked: number;
  transitioned: number;
  stillPending: number;
  escalated: number;
  splitStateHealed: number;
  errors: number;
};

export async function reconcilePendingPayments(now: Date = new Date()): Promise<ReconcileSummary> {
  const summary: ReconcileSummary = {
    checked: 0,
    transitioned: 0,
    stillPending: 0,
    escalated: 0,
    splitStateHealed: 0,
    errors: 0,
  };

  // --- 1. Split state: payment SUCCESS but order never advanced ---------
  const splitState = await prisma.payment.findMany({
    where: { status: "SUCCESS", order: { status: "PENDING_PAYMENT" } },
    select: { reference: true, orderId: true, order: { select: { orderNumber: true } } },
    take: MAX_BATCH,
  });
  for (const p of splitState) {
    try {
      const healed = await prisma.order.updateMany({
        where: { id: p.orderId, status: "PENDING_PAYMENT" },
        data: { status: "PAID" },
      });
      if (healed.count > 0) {
        summary.splitStateHealed++;
        await autoResolvePaymentIssue(
          "PAID_ORDER_NOT_ADVANCED",
          p.reference,
          "Order advanced to PAID by the reconciler.",
        );
        logger.info("reconcile_split_state_healed", { reference: p.reference, orderId: p.orderId });
      }
    } catch (err) {
      summary.errors++;
      logger.error("reconcile_split_state_failed", {
        reference: p.reference,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // --- 2. Stale PENDING payments: re-verify against Paystack -----------
  const staleBefore = new Date(now.getTime() - STALE_AFTER_MS);
  const stale = await prisma.payment.findMany({
    where: { status: "PENDING", updatedAt: { lt: staleBefore }, order: { status: "PENDING_PAYMENT" } },
    orderBy: { updatedAt: "asc" },
    take: MAX_BATCH,
    select: { reference: true, orderId: true, createdAt: true, order: { select: { orderNumber: true, totalKobo: true } } },
  });

  for (const p of stale) {
    summary.checked++;
    try {
      const verify = await verifyTransaction(p.reference);
      const result = await applyPaystackOutcome(verify);

      if (result.found && result.paymentStatus !== "PENDING") {
        summary.transitioned++;
        continue;
      }

      summary.stillPending++;
      const ageMs = now.getTime() - p.createdAt.getTime();
      if (ageMs > ESCALATE_AFTER_MS) {
        summary.escalated++;
        await recordPaymentIssue({
          type: "STUCK_PENDING",
          reference: p.reference,
          orderId: p.orderId,
          orderNumber: p.order.orderNumber,
          expectedKobo: p.order.totalKobo,
          currency: "NGN",
          detail: `Payment has been PENDING for ${Math.round(ageMs / 3_600_000)}h and Paystack still does not report success. Check the Paystack dashboard: either the customer never paid (safe to leave / cancel) or a charge is not being reported back.`,
          context: { paystackOutcome: verify.outcome },
        });
      }
    } catch (err) {
      summary.errors++;
      logger.error("reconcile_verify_failed", {
        reference: p.reference,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info("reconcile_complete", { ...summary });
  return summary;
}
