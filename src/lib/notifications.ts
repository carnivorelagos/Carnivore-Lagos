import type { NotificationType } from "@prisma/client";
import { prisma } from "./prisma";
import { logger } from "./logger";
import { sendOrderStatusSms } from "./sms";
import { sendOrderStatusEmail } from "./email";
import { sendWebPushToCustomer } from "./webPush";

/**
 * Order-status notifications. One durable Notification row per
 * (order, transition) — the in-app notification centre reads that table;
 * SMS / email / web-push are delivery layers on top. Every send is
 * best-effort: logged and swallowed, never allowed to fail the
 * status-change request that triggered it.
 *
 * Idempotent: the `@@unique([orderId, type])` constraint means a repeated
 * transition (an admin double-click, a webhook retry, a reconcile pass)
 * inserts nothing the second time, and the outbound channels only fire on
 * the insert that actually created the row.
 */

type Channels = { inApp: boolean; push: boolean; sms: boolean; email: boolean };

// Channel policy per transition. inApp + push are always on (opt-out does
// not touch them); sms/email are additionally gated by
// Customer.orderUpdatesOptOut. SMS is reserved for the few transitions
// that are time-critical or need the customer to act.
const CHANNELS: Record<NotificationType, Channels> = {
  PAYMENT_CONFIRMED: { inApp: true, push: true, sms: false, email: false }, // receipt email already sent
  ORDER_CONFIRMED: { inApp: true, push: true, sms: false, email: true },
  ORDER_PREPARING: { inApp: true, push: true, sms: false, email: true },
  ORDER_READY: { inApp: true, push: true, sms: true, email: true },
  ORDER_OUT_FOR_DELIVERY: { inApp: true, push: true, sms: true, email: false },
  ORDER_DELIVERED: { inApp: true, push: true, sms: false, email: true },
  ORDER_COMPLETED: { inApp: true, push: true, sms: false, email: false },
  ORDER_CANCELLED: { inApp: true, push: true, sms: true, email: true },
};

const COPY: Record<NotificationType, { title: string; body: (isDelivery: boolean) => string; sms: string }> = {
  PAYMENT_CONFIRMED: {
    title: "Payment confirmed",
    body: () => "We've got your payment. The kitchen will confirm your order shortly.",
    sms: "payment received, the kitchen will confirm shortly",
  },
  ORDER_CONFIRMED: {
    title: "Order confirmed",
    body: () => "The kitchen has confirmed your order and will start on it soon.",
    sms: "your order is confirmed",
  },
  ORDER_PREPARING: {
    title: "Being prepared",
    body: () => "Your order is on the grill now.",
    sms: "your order is being prepared",
  },
  ORDER_READY: {
    title: "Ready",
    body: (isDelivery) =>
      isDelivery ? "Your order is ready and waiting for a rider." : "Your order is ready for pickup.",
    sms: "your order is ready",
  },
  ORDER_OUT_FOR_DELIVERY: {
    title: "Out for delivery",
    body: () => "Your order has left the kitchen and is on its way to you.",
    sms: "your order is on its way",
  },
  ORDER_DELIVERED: {
    title: "Delivered",
    body: () => "Your order has been delivered. Enjoy!",
    sms: "your order has been delivered",
  },
  ORDER_COMPLETED: {
    title: "Completed",
    body: () => "Your order is complete. Thanks for choosing us!",
    sms: "your order is complete",
  },
  ORDER_CANCELLED: {
    title: "Order cancelled",
    body: () => "Your order has been cancelled. If you were charged, a refund follows to your payment method.",
    sms: "your order has been cancelled; any charge will be refunded",
  },
};

export function notificationTypeForStatus(status: string): NotificationType | null {
  switch (status) {
    case "PAID":
      return "PAYMENT_CONFIRMED";
    case "CONFIRMED":
      return "ORDER_CONFIRMED";
    case "PREPARING":
      return "ORDER_PREPARING";
    case "READY":
      return "ORDER_READY";
    case "OUT_FOR_DELIVERY":
      return "ORDER_OUT_FOR_DELIVERY";
    case "DELIVERED":
      return "ORDER_DELIVERED";
    case "COMPLETED":
      return "ORDER_COMPLETED";
    case "CANCELLED":
      return "ORDER_CANCELLED";
    default:
      return null;
  }
}

export type NotifiableOrder = {
  id: string;
  orderNumber: string;
  fulfillmentType: "PICKUP" | "DELIVERY";
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
};

function orderUrl(orderNumber: string): string | undefined {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  return base ? `${base.replace(/\/$/, "")}/account/orders/${encodeURIComponent(orderNumber)}` : undefined;
}

/**
 * Record + deliver a single order-status notification. Safe to call more
 * than once for the same (order, type) — the second call is a no-op.
 */
export async function notifyOrderTransition(order: NotifiableOrder, type: NotificationType): Promise<void> {
  const channels = CHANNELS[type];
  const copy = COPY[type];
  const isDelivery = order.fulfillmentType === "DELIVERY";
  const body = copy.body(isDelivery);
  const url = orderUrl(order.orderNumber);

  // 1. Durable in-app row (registered customers only — the table requires
  //    a customerId). Idempotent via the unique (orderId, type) index.
  let firstTime = true;
  if (order.customerId && channels.inApp) {
    try {
      const res = await prisma.notification.createMany({
        data: [
          {
            customerId: order.customerId,
            orderId: order.id,
            orderNumber: order.orderNumber,
            type,
            title: copy.title,
            body,
          },
        ],
        skipDuplicates: true,
      });
      firstTime = res.count > 0;
    } catch (err) {
      logger.error("notification_row_failed", {
        orderId: order.id,
        type,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // A repeat transition: the row already existed, so don't re-blast the
  // outbound channels.
  if (order.customerId && !firstTime) {
    logger.info("notification_skipped_duplicate", { orderId: order.id, type });
    return;
  }

  // 2. Respect the SMS/email opt-out (push + in-app are exempt).
  let optedOut = false;
  if (order.customerId) {
    const c = await prisma.customer
      .findUnique({ where: { id: order.customerId }, select: { orderUpdatesOptOut: true } })
      .catch(() => null);
    optedOut = c?.orderUpdatesOptOut ?? false;
  }

  // 3. Fan out. Each channel independent; a failure never throws.
  const jobs: Promise<unknown>[] = [];

  if (channels.push && order.customerId) {
    jobs.push(
      sendWebPushToCustomer(order.customerId, {
        title: copy.title,
        body,
        url: url ? `/account/orders/${encodeURIComponent(order.orderNumber)}` : undefined,
        tag: `order-${order.orderNumber}`,
      }).catch((err) =>
        logger.error("notification_push_failed", { orderId: order.id, type, message: String(err) }),
      ),
    );
  }

  if (channels.sms && !optedOut && order.customerPhone) {
    jobs.push(
      sendOrderStatusSms(order.customerPhone, {
        orderNumber: order.orderNumber,
        message: copy.sms,
        url,
      }).catch((err) =>
        logger.error("notification_sms_failed", { orderId: order.id, type, message: String(err) }),
      ),
    );
  }

  if (channels.email && !optedOut && order.customerEmail) {
    jobs.push(
      sendOrderStatusEmail(order.customerEmail, {
        orderNumber: order.orderNumber,
        heading: copy.title,
        message: body,
        url,
        customerName: order.customerName,
      }).catch((err) =>
        logger.error("notification_email_failed", { orderId: order.id, type, message: String(err) }),
      ),
    );
  }

  await Promise.all(jobs);
  logger.info("notification_sent", { orderId: order.id, type, channels });
}
