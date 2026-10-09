import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { adminAssignRiderSchema, uuidSchema } from "@/lib/validation";
import { notFound, validationError } from "@/lib/errors";

/**
 * Assign (or, with `riderId: null`, unassign) a rider to a delivery
 * order. Separate from PATCH .../status — this never changes
 * OrderStatus, so it can't collide with the order-status flow's own
 * optimistic-concurrency expectations.
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

  if (riderId !== null) {
    const rider = await prisma.rider.findUnique({ where: { id: riderId } });
    if (!rider || !rider.isActive) {
      throw validationError("That rider isn't available to assign.");
    }
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { riderId },
    include: { items: { include: { product: { select: { imageUrl: true } } } }, payment: true, rider: true },
  });

  const { items, ...rest } = updated;
  const flatItems = items.map(({ product, ...item }) => ({ ...item, imageUrl: product?.imageUrl ?? null }));
  return ok({ ...rest, items: flatItems });
});
