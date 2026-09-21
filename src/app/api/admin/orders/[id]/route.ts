import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { notFound } from "@/lib/errors";
import { uuidSchema } from "@/lib/validation";
import { logger } from "@/lib/logger";

/**
 * Full detail in one call (Section 47) — customer info, items, unit
 * prices, totals, payment status — so the admin dashboard never fans out
 * into several requests to render one order.
 */
export const GET = withApiHandler(async (req: NextRequest, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;

  const order = await prisma.order.findUnique({
    where: { id: uuidSchema.parse(id) },
    include: {
      items: { include: { product: { select: { imageUrl: true } } } },
      payment: true,
    },
  });

  // A soft-deleted order 404s here too, same as it's absent from the list
  // — an old bookmark/tab shouldn't be able to see it either.
  if (!order || order.deletedAt) throw notFound("Order");

  // Flatten the joined product's *current* image onto each item — orders
  // never snapshot it, so this reflects whatever photo the product has now.
  const items = order.items.map(({ product, ...item }) => ({
    ...item,
    imageUrl: product?.imageUrl ?? null,
  }));

  return ok({ ...order, items });
});

/**
 * Soft delete only — see the comment on Order.deletedAt in schema.prisma.
 * Hides the order from the admin dashboard; the row, its items, and its
 * payment record are untouched.
 */
export const DELETE = withApiHandler(async (req: NextRequest, ctx) => {
  const session = await requireAdmin(req);
  const { id } = await ctx.params;
  const orderId = uuidSchema.parse(id);

  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing || existing.deletedAt) throw notFound("Order");

  await prisma.order.update({ where: { id: orderId }, data: { deletedAt: new Date() } });
  logger.info("admin_order_deleted", { adminId: session.adminId, orderId });

  return ok({ deleted: true });
});
