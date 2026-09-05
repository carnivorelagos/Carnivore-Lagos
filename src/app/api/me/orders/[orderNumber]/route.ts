import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireCustomer } from "@/lib/auth/requireCustomer";
import { notFound } from "@/lib/errors";

export const GET = withApiHandler(async (req: NextRequest, ctx) => {
  const session = await requireCustomer(req);
  const { orderNumber } = await ctx.params;

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      items: true,
      payment: { select: { reference: true, status: true, paidAt: true } },
    },
  });

  if (!order || order.customerId !== session.customerId) {
    // Same not-found response whether the order doesn't exist or simply
    // isn't this customer's — never confirms another customer's order
    // number is valid.
    throw notFound("Order");
  }

  return ok(order);
});
