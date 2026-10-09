import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { notFound } from "@/lib/errors";
import { isRiderLocationFresh, RIDER_TRACKING_VISIBLE_STATUSES } from "@/lib/riders";

/**
 * Live rider position for one order, gated by trackingSlug — same
 * capability model as GET /api/orders/[slug] itself, kept as a separate
 * endpoint (rather than added to that response) so this stays a cheap,
 * poll-friendly, cacheless read that never risks the main order payload.
 * Deliberately never exposes the rider's phone number to the customer.
 */
export const GET = withApiHandler(async (req: NextRequest, ctx) => {
  const { slug } = await ctx.params;

  const order = await prisma.order.findUnique({
    where: { trackingSlug: slug },
    select: {
      status: true,
      fulfillmentType: true,
      deliveryLat: true,
      deliveryLng: true,
      rider: { select: { name: true, lastLat: true, lastLng: true, lastSeenAt: true } },
    },
  });
  if (!order) throw notFound("Order");

  const destination =
    order.deliveryLat !== null && order.deliveryLng !== null
      ? { lat: Number(order.deliveryLat), lng: Number(order.deliveryLng) }
      : null;

  const visible =
    order.fulfillmentType === "DELIVERY" && RIDER_TRACKING_VISIBLE_STATUSES.has(order.status);

  const fresh =
    visible &&
    order.rider &&
    order.rider.lastLat !== null &&
    order.rider.lastLng !== null &&
    isRiderLocationFresh(order.rider.lastSeenAt);

  return ok({
    destination,
    rider: fresh
      ? {
          name: order.rider!.name,
          lat: Number(order.rider!.lastLat),
          lng: Number(order.rider!.lastLng),
          lastSeenAt: order.rider!.lastSeenAt!.toISOString(),
        }
      : null,
  });
});
