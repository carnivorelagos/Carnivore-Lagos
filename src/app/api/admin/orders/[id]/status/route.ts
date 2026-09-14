import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { adminOrderStatusUpdateSchema, uuidSchema } from "@/lib/validation";
import { AppError, ErrorCode, notFound } from "@/lib/errors";
import { isValidTransition, type OrderStatus, type FulfillmentType } from "@/lib/orderStateMachine";
import { notifyOrderTransition, notificationTypeForStatus } from "@/lib/notifications";
import { logger } from "@/lib/logger";

/**
 * Validated against the explicit allow-list (Section 9) — no arbitrary
 * status strings, no reverse transitions. The update itself is a
 * conditional `updateMany` guarded by the status we just read, so two
 * admins updating the same order at the same instant can't silently
 * clobber each other (Section 45/52): the loser gets CONFLICT and has to
 * refresh and retry against the order's actual current state, rather than
 * overwriting whatever the winner just set.
 *
 * On a successful transition it fires the customer notification for that
 * step (in-app + push always, SMS/email per the policy in
 * src/lib/notifications.ts) — best-effort, never fails the request.
 */
export const PATCH = withApiHandler(async (req: NextRequest, ctx) => {
  const session = await requireAdmin(req);
  const { id } = await ctx.params;
  const orderId = uuidSchema.parse(id);
  const { status: nextStatus } = adminOrderStatusUpdateSchema.parse(await req.json());

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, fulfillmentType: true },
  });
  if (!order) throw notFound("Order");

  const currentStatus = order.status as OrderStatus;
  const fulfillment = order.fulfillmentType as FulfillmentType;

  if (!isValidTransition(currentStatus, nextStatus, fulfillment)) {
    throw new AppError(
      ErrorCode.INVALID_TRANSITION,
      `Cannot move an order from ${currentStatus} to ${nextStatus}.`,
    );
  }

  const result = await prisma.order.updateMany({
    where: { id: orderId, status: currentStatus },
    data: { status: nextStatus },
  });

  if (result.count === 0) {
    throw new AppError(
      ErrorCode.CONFLICT,
      "This order was changed by someone else. Please refresh and try again.",
    );
  }

  logger.info("order_status_changed", {
    orderId,
    from: currentStatus,
    to: nextStatus,
    adminId: session.adminId,
  });

  const updated = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true, payment: true },
  });

  const notifType = notificationTypeForStatus(nextStatus);
  if (notifType) {
    await notifyOrderTransition(
      {
        id: updated.id,
        orderNumber: updated.orderNumber,
        trackingSlug: updated.trackingSlug,
        fulfillmentType: updated.fulfillmentType as FulfillmentType,
        customerId: updated.customerId,
        customerName: updated.customerName,
        customerPhone: updated.customerPhone,
        customerEmail: updated.customerEmail,
      },
      notifType,
    );
  }

  return ok(updated);
});
