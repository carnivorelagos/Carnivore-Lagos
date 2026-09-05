import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireCustomer } from "@/lib/auth/requireCustomer";
import { paginationSchema } from "@/lib/validation";

/**
 * The in-app notification centre. `unreadCount` is always returned (for
 * the header badge) regardless of the page requested.
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  const session = await requireCustomer(req);
  const { searchParams } = new URL(req.url);
  const { page, limit } = paginationSchema.parse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  const unreadOnly = searchParams.get("unread") === "1";

  const where = {
    customerId: session.customerId,
    ...(unreadOnly ? { readAt: null } : {}),
  };

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { customerId: session.customerId, readAt: null } }),
  ]);

  return ok({ items, page, limit, total, unreadCount });
});

/** Mark every unread notification for this customer as read. */
export const PATCH = withApiHandler(async (req: NextRequest) => {
  const session = await requireCustomer(req);
  const res = await prisma.notification.updateMany({
    where: { customerId: session.customerId, readAt: null },
    data: { readAt: new Date() },
  });
  return ok({ marked: res.count });
});
