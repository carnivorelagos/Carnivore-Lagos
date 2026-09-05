import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireCustomer } from "@/lib/auth/requireCustomer";
import { paginationSchema } from "@/lib/validation";

export const GET = withApiHandler(async (req: NextRequest) => {
  const session = await requireCustomer(req);
  const { searchParams } = new URL(req.url);
  const { page, limit } = paginationSchema.parse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  const where = { customerId: session.customerId };
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
        totalKobo: true,
        createdAt: true,
      },
    }),
    prisma.order.count({ where }),
  ]);

  return ok({ items, page, limit, total });
});
