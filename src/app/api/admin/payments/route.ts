import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { adminPaymentIssueListQuerySchema } from "@/lib/validation";

/**
 * Payment anomalies for the admin dashboard — amount mismatches, orphan
 * charges, stuck-pending payments, and paid-but-not-advanced orders,
 * written by applyPaystackOutcome and the reconciler. Defaults to OPEN
 * issues; `?status=` widens it. `openCount` is always returned so the nav
 * can badge it.
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  await requireAdmin(req);
  const { searchParams } = new URL(req.url);
  const { page, limit, status } = adminPaymentIssueListQuerySchema.parse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });

  const where = status ? { status } : { status: "OPEN" as const };

  const [items, total, openCount] = await Promise.all([
    prisma.paymentIssue.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.paymentIssue.count({ where }),
    prisma.paymentIssue.count({ where: { status: "OPEN" } }),
  ]);

  return ok({ items, page, limit, total, openCount });
});
