import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { adminBulkDeleteOrdersSchema } from "@/lib/validation";
import { logger } from "@/lib/logger";

type RowResult = { id: string; ok: boolean; error?: string };

/**
 * Soft-delete many orders at once — see the comment on Order.deletedAt in
 * schema.prisma. Each id is independent: one already deleted or missing is
 * reported and skipped, the rest still go through.
 */
export const DELETE = withApiHandler(async (req: NextRequest) => {
  const session = await requireAdmin(req);
  const { orderIds } = adminBulkDeleteOrdersSchema.parse(await req.json());

  const ids = Array.from(new Set(orderIds));
  const existing = await prisma.order.findMany({
    where: { id: { in: ids } },
    select: { id: true, deletedAt: true },
  });
  const byId = new Map(existing.map((o) => [o.id, o]));

  const results: RowResult[] = [];
  const toDelete: string[] = [];

  for (const id of ids) {
    const order = byId.get(id);
    if (!order) {
      results.push({ id, ok: false, error: "Order not found." });
    } else if (order.deletedAt) {
      results.push({ id, ok: false, error: "Already deleted." });
    } else {
      toDelete.push(id);
      results.push({ id, ok: true });
    }
  }

  if (toDelete.length > 0) {
    await prisma.order.updateMany({
      where: { id: { in: toDelete } },
      data: { deletedAt: new Date() },
    });
  }

  logger.info("admin_bulk_order_delete", {
    adminId: session.adminId,
    requested: ids.length,
    deleted: toDelete.length,
  });

  return ok({ results, deleted: toDelete.length, failed: results.length - toDelete.length });
});
