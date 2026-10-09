import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { adminAssignRiderSchema, uuidSchema } from "@/lib/validation";
import { notFound, validationError } from "@/lib/errors";
import { sendRiderAssignmentEmail } from "@/lib/email";
import { sendWebPushToRider } from "@/lib/webPush";
import { logger } from "@/lib/logger";

/**
 * Assign (or, with `riderId: null`, unassign) a rider to a delivery
 * order. Separate from PATCH .../status — this never changes
 * OrderStatus, so it can't collide with the order-status flow's own
 * optimistic-concurrency expectations.
 *
 * A genuine new assignment (not a no-op re-save, never on unassign)
 * notifies the rider by email and web push, both carrying their
 * tracking link — so losing the link is never a dead end, it's resent
 * with every delivery. Both are best-effort: a failure here never blocks
 * the assignment itself.
 */
export const PATCH = withApiHandler(async (req: NextRequest, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const orderId = uuidSchema.parse(id);
  const { riderId } = adminAssignRiderSchema.parse(await req.json());

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.deletedAt) throw notFound("Order");
  if (order.fulfillmentType !== "DELIVERY") {
    throw validationError("Only delivery orders can have a rider assigned.");
  }

  let rider = null;
  if (riderId !== null) {
    rider = await prisma.rider.findUnique({ where: { id: riderId } });
    if (!rider || !rider.isActive) {
      throw validationError("That rider isn't available to assign.");
    }
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { riderId },
    include: { items: { include: { product: { select: { imageUrl: true } } } }, payment: true, rider: true },
  });

  const assignedRider = rider !== null && riderId !== order.riderId ? rider : null;
  if (assignedRider) {
    const base = (process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin).replace(/\/$/, "");
    const link = `${base}/rider/${assignedRider.token}`;
    const notifyParams = {
      riderName: assignedRider.name,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      deliveryAddress: order.deliveryAddress,
      link,
    };

    if (assignedRider.email) {
      await sendRiderAssignmentEmail(assignedRider.email, notifyParams).catch((err) => {
        logger.error("rider_assignment_email_failed", {
          riderId: assignedRider.id,
          orderId,
          message: err instanceof Error ? err.message : String(err),
        });
      });
    }
    await sendWebPushToRider(assignedRider.id, {
      title: "New delivery",
      body: `${order.orderNumber} for ${order.customerName}`,
      url: `/rider/${assignedRider.token}`,
      tag: "rider-assignment",
    }).catch((err) => {
      logger.error("rider_assignment_push_failed", {
        riderId: assignedRider.id,
        orderId,
        message: err instanceof Error ? err.message : String(err),
      });
    });
  }

  const { items, ...rest } = updated;
  const flatItems = items.map(({ product, ...item }) => ({ ...item, imageUrl: product?.imageUrl ?? null }));
  return ok({ ...rest, items: flatItems });
});
