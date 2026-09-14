import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { getDeviceProfile } from "@/lib/auth/deviceProfile";

/**
 * This device's order history + one-tap-reorder feed (amendment 2). Keyed
 * on the `device_token` cookie; no login. Also reports whether the device
 * has a saved card and whether its history has been secured to a verified
 * email. An unrecognised device gets an empty, valid payload.
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  const device = await getDeviceProfile(req);
  if (!device) {
    return ok({ orders: [], savedCard: null, secured: false, securedEmail: null });
  }

  const orders = await prisma.order.findMany({
    where: { deviceProfileId: device.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      trackingSlug: true,
      orderNumber: true,
      status: true,
      fulfillmentType: true,
      totalKobo: true,
      createdAt: true,
      items: { select: { productNameSnapshot: true, quantity: true } },
    },
  });

  return ok({
    orders,
    savedCard: device.paystackAuthorizationCode
      ? { brand: device.paystackCardBrand, last4: device.paystackCardLast4 }
      : null,
    secured: !!device.verifiedContactEmail,
    securedEmail: device.verifiedContactEmail,
  });
});
