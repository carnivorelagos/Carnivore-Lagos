import { prisma } from "./prisma";
import { logger } from "./logger";

/**
 * Recording a payment anomaly must never break payment processing itself.
 * Every function here is best-effort: it logs and swallows on failure
 * (including the case where the migration that creates the table hasn't
 * been applied yet). The authoritative money-state transitions happen
 * before any of this is called.
 */

export type PaymentIssueType =
  | "AMOUNT_MISMATCH"
  | "ORPHAN_CHARGE"
  | "STUCK_PENDING"
  | "PAID_ORDER_NOT_ADVANCED";

export type RecordIssueInput = {
  type: PaymentIssueType;
  reference: string;
  orderId?: string | null;
  orderNumber?: string | null;
  expectedKobo?: number | null;
  observedKobo?: number | null;
  currency?: string | null;
  detail: string;
  context?: Record<string, unknown> | null;
};

/**
 * Upsert on (type, reference): a repeated webhook or a repeated reconciler
 * pass refreshes the same row rather than creating duplicates. Re-opens a
 * row that a human had marked RESOLVED if the same anomaly recurs.
 */
export async function recordPaymentIssue(input: RecordIssueInput): Promise<void> {
  logger.error("payment_issue", {
    type: input.type,
    reference: input.reference,
    orderId: input.orderId ?? undefined,
    detail: input.detail,
    expectedKobo: input.expectedKobo ?? undefined,
    observedKobo: input.observedKobo ?? undefined,
  });

  try {
    await prisma.paymentIssue.upsert({
      where: { type_reference: { type: input.type, reference: input.reference } },
      create: {
        type: input.type,
        reference: input.reference,
        orderId: input.orderId ?? undefined,
        orderNumber: input.orderNumber ?? undefined,
        expectedKobo: input.expectedKobo ?? undefined,
        observedKobo: input.observedKobo ?? undefined,
        currency: input.currency ?? undefined,
        detail: input.detail,
        context: (input.context ?? undefined) as object | undefined,
      },
      update: {
        status: "OPEN",
        resolvedAt: null,
        resolvedBy: null,
        orderId: input.orderId ?? undefined,
        orderNumber: input.orderNumber ?? undefined,
        expectedKobo: input.expectedKobo ?? undefined,
        observedKobo: input.observedKobo ?? undefined,
        currency: input.currency ?? undefined,
        detail: input.detail,
        context: (input.context ?? undefined) as object | undefined,
      },
    });
  } catch (err) {
    logger.error("payment_issue_record_failed", {
      type: input.type,
      reference: input.reference,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Best-effort: close an issue the system healed on its own. */
export async function autoResolvePaymentIssue(
  type: PaymentIssueType,
  reference: string,
  detail: string,
): Promise<void> {
  try {
    await prisma.paymentIssue.updateMany({
      where: { type, reference, status: "OPEN" },
      data: { status: "RESOLVED", resolvedAt: new Date(), resolvedBy: "system", detail },
    });
  } catch {
    // table may not exist yet / transient — non-critical
  }
}
