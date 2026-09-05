import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { paymentsInitializeSchema } from "@/lib/validation";
import { armPaymentForOrder } from "@/lib/payments";
import { enforceRateLimit, clientIp } from "@/lib/rateLimit";
import { requireCustomer } from "@/lib/auth/requireCustomer";
import { AppError, ErrorCode, notFound } from "@/lib/errors";

/**
 * Under accounts-only checkout, every order belongs to an authenticated
 * customer, so this now checks two things a fully anonymous version
 * couldn't: that the order actually belongs to whoever is calling
 * (Section: accounts-only), and that their account email is verified
 * (Section: "email gate is at the money step, not the door") — the
 * account's own verified email is what's sent to Paystack, never the
 * per-order customerEmail snapshot, since that field stays editable for
 * delivery-contact purposes and isn't guaranteed to be a real, owned
 * inbox.
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  const session = await requireCustomer(req);
  const { orderId } = paymentsInitializeSchema.parse(await req.json());

  await enforceRateLimit({ key: `payment_init:${orderId}`, max: 10 });
  await enforceRateLimit({ key: `payment_init:${clientIp(req)}`, max: 20 });

  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { customerId: true } });
  if (!order || order.customerId !== session.customerId) {
    // Same not-found response either way — never confirms another
    // customer's order id is valid.
    throw notFound("Order");
  }

  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: session.customerId } });
  if (!customer.emailVerifiedAt || !customer.email) {
    throw new AppError(ErrorCode.EMAIL_NOT_VERIFIED, "Verify your email before paying online.");
  }

  const result = await armPaymentForOrder({ orderId, customerEmail: customer.email });
  return ok({ reference: result.reference, accessCode: result.accessCode });
});
