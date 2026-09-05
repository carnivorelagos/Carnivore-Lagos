import { NextRequest } from "next/server";
import { ok, withApiHandler } from "@/lib/api-response";
import { notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { orderLookupQuerySchema } from "@/lib/validation";

/**
 * Confirmation-page lookup. `orderNumber` alone is not enough — it's
 * visible in the URL and Section 37's format has real but limited
 * entropy, so a second factor (the Payment reference issued at
 * initialize) is required to view another customer's order (Section 38
 * privacy). An order with no Payment row yet (never initialized) has
 * nothing that could match `ref`, so it's correctly unreachable through
 * this route — that's the pre-payment resume window the checkout flow
 * handles via the idempotency key instead, not this endpoint.
 */
export const GET = withApiHandler(async (req: NextRequest, ctx) => {
  const { orderNumber } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const { ref } = orderLookupQuerySchema.parse({ ref: searchParams.get("ref") });

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      fulfillmentType: true,
      subtotalKobo: true,
      deliveryFeeKobo: true,
      totalKobo: true,
      createdAt: true,
      items: {
        select: { productNameSnapshot: true, unitPriceKobo: true, quantity: true, lineTotalKobo: true },
      },
      payment: { select: { reference: true, status: true, paidAt: true } },
    },
  });

  if (!order || !order.payment || order.payment.reference !== ref) {
    throw notFound("Order");
  }

  return ok(order);
});
