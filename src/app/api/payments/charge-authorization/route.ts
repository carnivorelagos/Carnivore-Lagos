import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { chargeSavedCardSchema } from "@/lib/validation";
import { assertSameOrigin } from "@/lib/auth/csrf";
import { getDeviceProfile } from "@/lib/auth/deviceProfile";
import { chargeOrderWithSavedCard } from "@/lib/payments";
import { enforceRateLimit, clientIp } from "@/lib/rateLimit";
import { AppError, ErrorCode, notFound } from "@/lib/errors";

/**
 * "Pay with your last card" (amendment 3). Charges the device's stored
 * reusable Paystack authorization for a still-unpaid order it owns — no
 * card re-entry, no popup. The charge is run through applyPaystackOutcome
 * exactly like a verify, so it's server-confirmed (amendment 5). Card
 * payments only; bank transfer / USSD reorders go through the normal
 * initialize + popup path.
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const { trackingSlug } = chargeSavedCardSchema.parse(await req.json());
  await enforceRateLimit({ key: `charge_saved:${clientIp(req)}`, max: 10 });

  const device = await getDeviceProfile(req);
  if (!device?.paystackAuthorizationCode || !device.paystackAuthEmail) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "There's no saved card on this device.");
  }

  const order = await prisma.order.findUnique({
    where: { trackingSlug },
    select: { id: true, deviceProfileId: true },
  });
  if (!order || order.deviceProfileId !== device.id) throw notFound("Order");

  const result = await chargeOrderWithSavedCard({
    orderId: order.id,
    authorizationCode: device.paystackAuthorizationCode,
    authEmail: device.paystackAuthEmail,
  });

  if (!result.found) {
    throw new AppError(ErrorCode.PAYMENT_VERIFICATION_FAILED, "The card charge could not be confirmed.");
  }

  return ok({
    orderStatus: result.orderStatus,
    paymentStatus: result.paymentStatus,
    amountMismatch: result.amountMismatch,
  });
});
