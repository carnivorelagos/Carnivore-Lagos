import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { adminBulkStatusSchema } from "@/lib/validation";
import {
  allowedNextStatuses,
  isValidTransition,
  type FulfillmentType,
  type OrderStatus,
} from "@/lib/orderStateMachine";
import { notifyOrderTransition, notificationTypeForStatus } from "@/lib/notifications";
import { logger } from "@/lib/logger";

type RowResult = { id: string; ok: boolean; from?: string; to?: string; error?: string };

/**
 * Advance many orders at once — the throughput lever for a busy kitchen.
 * With no `target`, each order moves one step along its own lifecycle
 * (fulfilment-aware); with a `target`, they all move to that status where
 * the transition is legal. Each order is independent: an illegal or
 * conflicting one is reported and skipped, the rest still go through.
 * Notifications fire for every order that actually moved.
 */
export const PATCH = withApiHandler(async (req: NextRequest) => {
  const session = await requireAdmin(req);
  const { orderIds, target } = adminBulkStatusSchema.parse(await req.json());

  const ids = Array.from(new Set(orderIds));
  const orders = await prisma.order.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      status: true,
      fulfillmentType: true,
      orderNumber: true,
      trackingSlug: true,
      customerId: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
    },
  });
  const byId = new Map(orders.map((o) => [o.id, o]));

  const results: RowResult[] = [];
  const notifyJobs: Promise<unknown>[] = [];

  for (const id of ids) {
    const order = byId.get(id);
    if (!order) {
      results.push({ id, ok: false, error: "Order not found." });
      continue;
    }
    const from = order.status as OrderStatus;
    const fulfillment = order.fulfillmentType as FulfillmentType;

    let to: OrderStatus | undefined = target;
    if (!to) {
      // "advance one step" — first non-cancel forward status.
      to = allowedNextStatuses(from, fulfillment).find((s) => s !== "CANCELLED");
    }
    if (!to) {
      results.push({ id, ok: false, from, error: "No forward transition from this status." });
      continue;
    }
    if (!isValidTransition(from, to, fulfillment)) {
      results.push({ id, ok: false, from, to, error: `Can't move ${from} → ${to}.` });
      continue;
    }

    const moved = await prisma.order.updateMany({
      where: { id, status: from },
      data: { status: to },
    });
    if (moved.count === 0) {
      results.push({ id, ok: false, from, to, error: "Changed by someone else — refresh." });
      continue;
    }

    results.push({ id, ok: true, from, to });

    const notifType = notificationTypeForStatus(to);
    if (notifType) {
      notifyJobs.push(
        notifyOrderTransition(
          {
            id: order.id,
            orderNumber: order.orderNumber,
            trackingSlug: order.trackingSlug,
            fulfillmentType: fulfillment,
            customerId: order.customerId,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            customerEmail: order.customerEmail,
          },
          notifType,
        ).catch((err) =>
          logger.error("bulk_status_notify_failed", { orderId: id, message: String(err) }),
        ),
      );
    }
  }

  await Promise.all(notifyJobs);

  const moved = results.filter((r) => r.ok).length;
  logger.info("admin_bulk_status", {
    adminId: session.adminId,
    requested: ids.length,
    moved,
    target: target ?? "advance",
  });

  return ok({ results, moved, failed: results.length - moved });
});
