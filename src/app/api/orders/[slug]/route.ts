import { NextRequest } from "next/server";
import { ok, withApiHandler } from "@/lib/api-response";
import { notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { getDeviceProfile } from "@/lib/auth/deviceProfile";

/**
 * Public order tracking by unguessable slug (amendment 1). The slug is the
 * capability — no `?ref=` second factor. `orderNumber` is returned as a
 * display label only and is never accepted as a lookup key.
 *
 * If the request comes from the device that placed the order and that
 * device has a reusable saved card, the response says so, so the tracking
 * page can offer one-tap "pay with your last card" on a still-unpaid
 * order.
 */
export const GET = withApiHandler(async (req: NextRequest, ctx) => {
  const { slug } = await ctx.params;

  const order = await prisma.order.findUnique({
    where: { trackingSlug: slug },
    select: {
      id: true,
      orderNumber: true,
      trackingSlug: true,
      status: true,
      fulfillmentType: true,
      customerName: true,
      deliveryAddress: true,
      notes: true,
      subtotalKobo: true,
      deliveryFeeKobo: true,
      totalKobo: true,
      createdAt: true,
      deviceProfileId: true,
      items: {
        select: { productNameSnapshot: true, unitPriceKobo: true, quantity: true, lineTotalKobo: true },
      },
      payment: { select: { status: true, paidAt: true } },
    },
  });

  if (!order) throw notFound("Order");

  const device = await getDeviceProfile(req);
  const ownedByThisDevice = !!device && order.deviceProfileId === device.id;
  const canPayWithSavedCard =
    ownedByThisDevice && order.status === "PENDING_PAYMENT" && !!device?.paystackAuthorizationCode;
  const savedCardLabel = canPayWithSavedCard
    ? [device?.paystackCardBrand ?? "Card", device?.paystackCardLast4 ? `···· ${device.paystackCardLast4}` : ""]
        .join(" ")
        .trim()
    : null;

  const { deviceProfileId: _drop, ...safe } = order;
  return ok({ ...safe, ownedByThisDevice, canPayWithSavedCard, savedCardLabel });
});
