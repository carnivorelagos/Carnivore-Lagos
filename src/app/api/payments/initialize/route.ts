import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { paymentsInitializeSchema } from "@/lib/validation";
import { armPaymentForOrder } from "@/lib/payments";
import { enforceRateLimit, clientIp } from "@/lib/rateLimit";
import { assertSameOrigin } from "@/lib/auth/csrf";
import { getDeviceProfile } from "@/lib/auth/deviceProfile";
import { AppError, ErrorCode, notFound } from "@/lib/errors";

/**
 * Arm a Paystack popup payment for an order under no-login checkout.
 * Ownership is the `device_token` cookie — the order must belong to the
 * device asking to pay for it. The email handed to Paystack is the order's
 * own `customerEmail` snapshot (collected at checkout), falling back to
 * the device's verified contact email; there is no account-email-verified
 * gate any more (amendment 4). An order with no email at all can't be paid
 * online until one is added.
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const { orderId } = paymentsInitializeSchema.parse(await req.json());

  await enforceRateLimit({ key: `payment_init:${orderId}`, max: 10 });
  await enforceRateLimit({ key: `payment_init:${clientIp(req)}`, max: 20 });

  const device = await getDeviceProfile(req);
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { deviceProfileId: true, customerEmail: true },
  });
  if (!order || !device || order.deviceProfileId !== device.id) {
    // Same not-found response either way — never confirms another
    // device's order id is valid.
    throw notFound("Order");
  }

  const email = order.customerEmail ?? device.verifiedContactEmail;
  if (!email) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Add an email to this order before paying online.",
    );
  }

  const result = await armPaymentForOrder({ orderId, customerEmail: email });
  return ok({ reference: result.reference, accessCode: result.accessCode });
});
