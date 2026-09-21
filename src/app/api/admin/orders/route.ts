import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { adminOrderListQuerySchema } from "@/lib/validation";

export const GET = withApiHandler(async (req: NextRequest) => {
  await requireAdmin(req);

  const { searchParams } = new URL(req.url);
  const { page, limit, status } = adminOrderListQuerySchema.parse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });

  // deletedAt: null — an admin "delete" only ever hides an order from the
  // admin dashboard (see the comment on Order.deletedAt); it's excluded
  // here and nowhere else.
  const where = { deletedAt: null, ...(status ? { status } : {}) };

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        fulfillmentType: true,
        customerName: true,
        totalKobo: true,
        createdAt: true,
        payment: { select: { status: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return ok({ items, page, limit, total });
});
