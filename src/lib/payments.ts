import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import { AppError, ErrorCode } from "./errors";
import {
  initializeTransaction,
  verifyTransaction,
  chargeAuthorization,
  type VerifyResult,
} from "./paystack";
import { sendReceiptEmail } from "./email";
import { recordPaymentIssue, autoResolvePaymentIssue } from "./paymentIssues";
import { notifyOrderTransition } from "./notifications";
import { alertAdminsPaidOrder } from "./adminAlerts";
import { getSettingsFresh } from "./settings";
import { logger } from "./logger";

type PaidOrderShape = {
  id: string;
  orderNumber: string;
  trackingSlug: string;
  fulfillmentType: string;
  customerId: string | null;
  deviceProfileId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
};

function notifiable(order: PaidOrderShape) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    trackingSlug: order.trackingSlug,
    fulfillmentType: order.fulfillmentType as "PICKUP" | "DELIVERY",
    customerId: order.customerId,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
  };
}

/**
 * On a successful *card* charge, persist the reusable Paystack
 * authorization against the device that placed the order (amendment 3),
 * so a future order can offer "pay with your last card". Card only —
 * bank transfer / USSD authorizations aren't reusable. Best-effort: a
 * failure here never fails the payment.
 */
async function captureReusableCard(order: PaidOrderShape, verify: VerifyResult): Promise<void> {
  const auth = verify.authorization;
  if (!order.deviceProfileId || !auth?.reusable || auth.channel === "bank_transfer" || auth.channel === "ussd") {
    return;
  }
  const email = verify.customerEmail ?? order.customerEmail;
  if (!email) return;
  try {
    await prisma.deviceProfile.update({
      where: { id: order.deviceProfileId },
      data: {
        paystackAuthorizationCode: auth.authorizationCode,
        paystackAuthEmail: email,
        paystackCardLast4: auth.last4,
        paystackCardBrand: auth.brand,
      },
    });
    logger.info("saved_card_captured", { deviceProfileId: order.deviceProfileId, last4: auth.last4 });
  } catch (err) {
    logger.error("saved_card_capture_failed", {
      orderId: order.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Fire the "payment confirmed" notification for a freshly-paid order. */
async function notifyPaid(order: PaidOrderShape): Promise<void> {
  await notifyOrderTransition(notifiable(order), "PAYMENT_CONFIRMED");
}

/**
 * If `autoConfirmPaidOrders` is on, move the just-paid order straight to
 * CONFIRMED so the kitchen doesn't have to click it. Guarded on
 * status = PAID so it never fights a concurrent admin action; fires the
 * ORDER_CONFIRMED notification only when it actually made the move.
 */
async function maybeAutoConfirm(order: PaidOrderShape): Promise<void> {
  let autoConfirm = true;
  try {
    autoConfirm = (await getSettingsFresh()).autoConfirmPaidOrders;
  } catch {
    autoConfirm = true; // default-on if settings can't be read
  }
  if (!autoConfirm) return;

  const moved = await prisma.order
    .updateMany({ where: { id: order.id, status: "PAID" }, data: { status: "CONFIRMED" } })
    .catch(() => ({ count: 0 }));
  if (moved.count > 0) {
    logger.info("order_auto_confirmed", { orderId: order.id });
    await notifyOrderTransition(notifiable(order), "ORDER_CONFIRMED");
  }
}

/**
 * Order statuses at or past PAID — an order that has reached any of these
 * has already been "advanced" past payment, so a late verify/webhook must
 * not try to move it again.
 */
const ADVANCED_ORDER_STATUSES = new Set(["PAID", "CONFIRMED", "PREPARING", "READY", "COMPLETED"]);

/**
 * POST /api/payments/initialize decision table (Section: "Payment retry
 * after failure").
 *
 * Two hardening changes over the original:
 *
 *  1. Before re-arming an existing non-SUCCESS Payment with a fresh
 *     reference, we re-verify the *current* reference against Paystack. If
 *     the customer completed the old popup in the same instant they hit
 *     "pay again", that charge is applied here instead of being orphaned
 *     by the overwrite.
 *  2. On the first attempt for an order, the PENDING Payment row is
 *     written *before* the Paystack `initialize` call, so there is never a
 *     Paystack reference that our database has no record of. If the
 *     `initialize` call then fails, the row is marked FAILED rather than
 *     left dangling as PENDING.
 *
 * Still exactly one Payment row per order (unique `orderId`), still no
 * duplicate charge, and a webhook for a now-superseded reference still
 * falls into the "reference not found → safe no-op / orphan-charge issue"
 * path in applyPaystackOutcome.
 */
export async function armPaymentForOrder(params: {
  orderId: string;
  customerEmail: string;
}): Promise<{ reference: string; accessCode: string; authorizationUrl: string }> {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: { payment: true },
  });
  if (!order) {
    throw new AppError(ErrorCode.NOT_FOUND, "Order not found.");
  }
  if (order.status !== "PENDING_PAYMENT") {
    if (order.status === "PAID") {
      throw new AppError(ErrorCode.ORDER_ALREADY_PAID, "This order has already been paid for.");
    }
    throw new AppError(ErrorCode.ORDER_NOT_PAYABLE, "This order can no longer accept a payment.");
  }
  if (order.payment?.status === "SUCCESS") {
    throw new AppError(ErrorCode.ORDER_ALREADY_PAID, "This order has already been paid for.");
  }

  // (1) Re-arm pre-check. (order.payment.status is PENDING or FAILED here —
  // the SUCCESS case was handled just above.)
  if (order.payment) {
    try {
      const existingVerify = await verifyTransaction(order.payment.reference);
      if (existingVerify.outcome === "success") {
        await applyPaystackOutcome(existingVerify);
        throw new AppError(ErrorCode.ORDER_ALREADY_PAID, "This order has already been paid for.");
      }
    } catch (err) {
      if (err instanceof AppError && err.code === ErrorCode.ORDER_ALREADY_PAID) throw err;
      // Paystack unreachable / verify failed — don't block a legitimate
      // retry on it. The webhook and the reconciler still protect the old
      // reference from becoming a silent orphan charge.
      logger.warn("arm_payment_precheck_failed", {
        orderId: order.id,
        reference: order.payment.reference,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const reference = `pay_${randomUUID()}`;

  if (order.payment) {
    // Re-arm: keep the OLD reference in the row until Paystack init
    // succeeds, then swap. A crash mid-call leaves an unused new Paystack
    // reference (no charge) with the DB still pointing at the recoverable
    // old one.
    const paystackResult = await initializeTransaction({
      email: params.customerEmail,
      amountKobo: order.totalKobo,
      reference,
    });
    const updated = await prisma.payment.updateMany({
      where: { orderId: order.id, status: { not: "SUCCESS" } },
      data: { reference: paystackResult.reference, status: "PENDING", amountKobo: order.totalKobo },
    });
    if (updated.count === 0) {
      throw new AppError(ErrorCode.ORDER_ALREADY_PAID, "This order has already been paid for.");
    }
    return paystackResult;
  }

  // (2) First attempt — write the row first.
  try {
    await prisma.payment.create({
      data: {
        orderId: order.id,
        reference,
        status: "PENDING",
        amountKobo: order.totalKobo,
        currency: "NGN",
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // A concurrent initialize created the row between our read and here.
      // Fall back to the re-arm path.
      const paystackResult = await initializeTransaction({
        email: params.customerEmail,
        amountKobo: order.totalKobo,
        reference,
      });
      const updated = await prisma.payment.updateMany({
        where: { orderId: order.id, status: { not: "SUCCESS" } },
        data: { reference: paystackResult.reference, status: "PENDING", amountKobo: order.totalKobo },
      });
      if (updated.count === 0) {
        throw new AppError(ErrorCode.ORDER_ALREADY_PAID, "This order has already been paid for.");
      }
      return paystackResult;
    }
    throw err;
  }

  try {
    return await initializeTransaction({
      email: params.customerEmail,
      amountKobo: order.totalKobo,
      reference,
    });
  } catch (err) {
    await prisma.payment
      .updateMany({ where: { reference, status: "PENDING" }, data: { status: "FAILED" } })
      .catch(() => undefined);
    throw err;
  }
}

export type ApplyOutcomeResult =
  | { found: false }
  | { found: true; orderStatus: string; paymentStatus: string; amountMismatch: boolean };

/**
 * The three-way verify/webhook branch (Section 17/45), used identically by
 * both the verify route and the webhook route so they can never disagree.
 *
 * Race safety without an interactive transaction: the payment transition
 * is a single conditional `updateMany` (`WHERE reference = ? AND status =
 * 'PENDING'`) — whichever caller arrives first wins, the other finds
 * count = 0 and re-reads the terminal state. The order is then advanced
 * with its own guarded `updateMany` (`WHERE status = 'PENDING_PAYMENT'`).
 * If a process dies between the two writes, the next verify/webhook (or
 * the reconciler) re-runs this and heals the order via the branch at the
 * top; if the order genuinely can't be advanced (it was cancelled), that
 * is recorded as a PAID_ORDER_NOT_ADVANCED issue for a human. This avoids
 * holding a Neon connection open for a multi-statement interactive
 * transaction on the payment hot path.
 */
export async function applyPaystackOutcome(verify: VerifyResult): Promise<ApplyOutcomeResult> {
  const payment = await prisma.payment.findUnique({
    where: { reference: verify.reference },
    include: { order: { include: { items: true } } },
  });

  if (!payment) {
    // Superseded reference (already overwritten by a retry) or genuinely
    // unknown. Normally a safe no-op — but a signature-valid *successful*
    // charge with a non-zero amount and no Payment row to attach it to is
    // a possible real charge with nowhere to land: record it.
    if (verify.outcome === "success" && verify.amountKobo > 0) {
      await recordPaymentIssue({
        type: "ORPHAN_CHARGE",
        reference: verify.reference,
        observedKobo: verify.amountKobo,
        currency: verify.currency,
        detail:
          "Paystack reports a successful charge for a reference with no Payment row (superseded by a retry, or unknown). Reconcile against the Paystack dashboard — a refund may be owed.",
        context: { raw: verify.raw },
      });
    }
    return { found: false };
  }

  if (payment.status !== "PENDING") {
    // Already terminal — duplicate delivery or a race we lost. One heal:
    // a SUCCESS payment whose order never advanced past PENDING_PAYMENT
    // (a crash between the two writes) — push it now.
    if (payment.status === "SUCCESS" && payment.order.status === "PENDING_PAYMENT") {
      const healed = await prisma.order.updateMany({
        where: { id: payment.orderId, status: "PENDING_PAYMENT" },
        data: { status: "PAID" },
      });
      if (healed.count > 0) {
        await autoResolvePaymentIssue(
          "PAID_ORDER_NOT_ADVANCED",
          verify.reference,
          "Order advanced to PAID on a later verify/webhook/reconcile pass.",
        );
        logger.info("payment_order_healed", { reference: verify.reference, orderId: payment.orderId });
        await captureReusableCard(payment.order, verify);
        await notifyPaid(payment.order);
        await alertAdminsPaidOrder(payment.order);
        await maybeAutoConfirm(payment.order);
        return { found: true, orderStatus: "PAID", paymentStatus: "SUCCESS", amountMismatch: false };
      }
    }
    return {
      found: true,
      orderStatus: payment.order.status,
      paymentStatus: payment.status,
      amountMismatch: false,
    };
  }

  if (verify.outcome === "pending") {
    return { found: true, orderStatus: payment.order.status, paymentStatus: "PENDING", amountMismatch: false };
  }

  if (verify.outcome === "failed") {
    const result = await prisma.payment.updateMany({
      where: { reference: verify.reference, status: "PENDING" },
      data: { status: "FAILED", rawVerification: verify.raw as object },
    });
    if (result.count === 0) {
      const latest = await prisma.payment.findUniqueOrThrow({
        where: { reference: verify.reference },
        include: { order: true },
      });
      return { found: true, orderStatus: latest.order.status, paymentStatus: latest.status, amountMismatch: false };
    }
    logger.info("payment_failed", { reference: verify.reference, orderId: payment.orderId });
    return { found: true, orderStatus: payment.order.status, paymentStatus: "FAILED", amountMismatch: false };
  }

  // outcome === "success"
  const amountMatches = verify.amountKobo === payment.order.totalKobo && verify.currency === "NGN";
  if (!amountMatches) {
    // "Full stop" per Section 17 — never mark paid on a mismatch. Left
    // PENDING for manual review, and now also surfaced as an issue rather
    // than only a log line.
    logger.error("payment_amount_mismatch", {
      reference: verify.reference,
      orderId: payment.orderId,
      expectedTotalKobo: payment.order.totalKobo,
      paystackAmountKobo: verify.amountKobo,
      paystackCurrency: verify.currency,
    });
    await recordPaymentIssue({
      type: "AMOUNT_MISMATCH",
      reference: verify.reference,
      orderId: payment.orderId,
      orderNumber: payment.order.orderNumber,
      expectedKobo: payment.order.totalKobo,
      observedKobo: verify.amountKobo,
      currency: verify.currency,
      detail:
        "Paystack reported success but the amount/currency does not match the order total. Order left PENDING_PAYMENT — do not fulfil until reconciled.",
      context: { raw: verify.raw },
    });
    return { found: true, orderStatus: payment.order.status, paymentStatus: "PENDING", amountMismatch: true };
  }

  // Win the payment transition.
  const updated = await prisma.payment.updateMany({
    where: { reference: verify.reference, status: "PENDING" },
    data: { status: "SUCCESS", paidAt: new Date(), rawVerification: verify.raw as object },
  });
  if (updated.count === 0) {
    const latest = await prisma.payment.findUniqueOrThrow({
      where: { reference: verify.reference },
      include: { order: true },
    });
    return { found: true, orderStatus: latest.order.status, paymentStatus: latest.status, amountMismatch: false };
  }

  // Advance the order — guarded so a CANCELLED order is never resurrected.
  const orderAdvanced = await prisma.order.updateMany({
    where: { id: payment.orderId, status: "PENDING_PAYMENT" },
    data: { status: "PAID" },
  });
  if (orderAdvanced.count === 0) {
    const fresh = await prisma.order.findUnique({
      where: { id: payment.orderId },
      select: { status: true, orderNumber: true },
    });
    if (!fresh || !ADVANCED_ORDER_STATUSES.has(fresh.status)) {
      await recordPaymentIssue({
        type: "PAID_ORDER_NOT_ADVANCED",
        reference: verify.reference,
        orderId: payment.orderId,
        orderNumber: fresh?.orderNumber ?? payment.order.orderNumber,
        expectedKobo: payment.order.totalKobo,
        observedKobo: verify.amountKobo,
        currency: verify.currency,
        detail: `Payment reached SUCCESS but the order is ${fresh?.status ?? "missing"} — likely cancelled during payment. A refund may be owed.`,
        context: { raw: verify.raw },
      });
    }
  }

  logger.info("payment_verified", { reference: verify.reference, orderId: payment.orderId });

  // Receipt email — fires once (only the caller that won the `updateMany`
  // above reaches here). Awaited, not fire-and-forget: Netlify Functions
  // can freeze the instant the response is sent. A failed send is logged,
  // never thrown — a lost receipt is not a reason to report a successful
  // payment as an error.
  if (payment.order.customerEmail) {
    try {
      await sendReceiptEmail(payment.order.customerEmail, {
        orderNumber: payment.order.orderNumber,
        fulfillmentType: payment.order.fulfillmentType,
        customerName: payment.order.customerName,
        items: payment.order.items,
        subtotalKobo: payment.order.subtotalKobo,
        deliveryFeeKobo: payment.order.deliveryFeeKobo,
        totalKobo: payment.order.totalKobo,
      });
    } catch (err) {
      logger.error("receipt_email_failed", {
        orderId: payment.orderId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  } else {
    logger.warn("receipt_email_skipped_no_email", { orderId: payment.orderId });
  }

  // Persist the reusable card against the device, if this was a card
  // charge and the device asked for it (amendment 3).
  await captureReusableCard(payment.order, verify);

  // In-app + push "payment confirmed" (idempotent; the receipt email
  // above already covers the email channel for this transition).
  await notifyPaid(payment.order);
  // Real-time kitchen alert (Web Push to opted-in admins).
  await alertAdminsPaidOrder(payment.order);
  await maybeAutoConfirm(payment.order);

  return { found: true, orderStatus: "PAID", paymentStatus: "SUCCESS", amountMismatch: false };
}

/**
 * Pay an existing PENDING_PAYMENT order with the device's saved card
 * (amendment 3). Arms the order's single Payment row with a fresh
 * reference, calls Paystack charge_authorization (no popup), then runs the
 * result through applyPaystackOutcome — so the charge is server-verified
 * exactly like every other payment (amendment 5). Card only; the caller is
 * responsible for confirming a reusable authorization exists.
 */
export async function chargeOrderWithSavedCard(params: {
  orderId: string;
  authorizationCode: string;
  authEmail: string;
}): Promise<ApplyOutcomeResult> {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: { payment: true },
  });
  if (!order) throw new AppError(ErrorCode.NOT_FOUND, "Order not found.");
  if (order.status !== "PENDING_PAYMENT") {
    if (order.status === "PAID") {
      throw new AppError(ErrorCode.ORDER_ALREADY_PAID, "This order has already been paid for.");
    }
    throw new AppError(ErrorCode.ORDER_NOT_PAYABLE, "This order can no longer accept a payment.");
  }
  if (order.payment?.status === "SUCCESS") {
    throw new AppError(ErrorCode.ORDER_ALREADY_PAID, "This order has already been paid for.");
  }

  const reference = `pay_${randomUUID()}`;

  if (order.payment) {
    const updated = await prisma.payment.updateMany({
      where: { orderId: order.id, status: { not: "SUCCESS" } },
      data: { reference, status: "PENDING", amountKobo: order.totalKobo },
    });
    if (updated.count === 0) {
      throw new AppError(ErrorCode.ORDER_ALREADY_PAID, "This order has already been paid for.");
    }
  } else {
    await prisma.payment.create({
      data: { orderId: order.id, reference, status: "PENDING", amountKobo: order.totalKobo, currency: "NGN" },
    });
  }

  let verify: VerifyResult;
  try {
    verify = await chargeAuthorization({
      authorizationCode: params.authorizationCode,
      email: params.authEmail,
      amountKobo: order.totalKobo,
      reference,
    });
  } catch (err) {
    await prisma.payment
      .updateMany({ where: { reference, status: "PENDING" }, data: { status: "FAILED" } })
      .catch(() => undefined);
    throw err;
  }

  return applyPaystackOutcome(verify);
}

export { verifyTransaction };
