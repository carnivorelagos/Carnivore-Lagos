import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { notFound } from "@/lib/errors";
import { riderTokenSchema } from "@/lib/validation";

// Still "in progress" from a rider's point of view — ready to go pick up,
// or already out with it. READY is included deliberately: a rider should
// be able to open their link and see where they're headed before the
// kitchen marks the order "out for delivery", not only after.
const ACTIVE_STATUSES = ["READY", "OUT_FOR_DELIVERY"] as const;

/**
 * A rider's own view of their link (Section: live tracking) — no login,
 * the token in the URL is the entire capability, same model as an order's
 * trackingSlug. An inactive/unknown token 404s rather than saying
 * "disabled", the same way a soft-deleted order does — nothing to leak
 * either way.
 */
export const GET = withApiHandler(async (req: NextRequest, ctx) => {
  const { token } = await ctx.params;
  const parsed = riderTokenSchema.safeParse(token);
  if (!parsed.success) throw notFound("Rider");

  const rider = await prisma.rider.findUnique({ where: { token: parsed.data } });
  if (!rider || !rider.isActive) throw notFound("Rider");

  const orders = await prisma.order.findMany({
    where: { riderId: rider.id, deletedAt: null, status: { in: [...ACTIVE_STATUSES] } },
    orderBy: { createdAt: "asc" },
    select: {
      orderNumber: true,
      status: true,
      customerName: true,
      customerPhone: true,
      deliveryAddress: true,
      deliveryLat: true,
      deliveryLng: true,
    },
  });

  return ok({ id: rider.id, name: rider.name, orders });
});
