import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { notFound } from "@/lib/errors";
import { uuidSchema } from "@/lib/validation";

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
      items: true,
      payment: true,
    },
  });

  if (!order) throw notFound("Order");
  return ok(order);
});
