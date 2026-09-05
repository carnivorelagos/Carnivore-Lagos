import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { adminPaymentIssueUpdateSchema, uuidSchema } from "@/lib/validation";
import { notFound } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Close a payment issue once a human has dealt with it (refunded,
 * confirmed a no-op, etc). Deliberately one-way — the system re-opens the
 * row itself if the same anomaly recurs.
 */
export const PATCH = withApiHandler(async (req: NextRequest, ctx) => {
  const session = await requireAdmin(req);
  const { id } = await ctx.params;
  const issueId = uuidSchema.parse(id);
  const { status } = adminPaymentIssueUpdateSchema.parse(await req.json());

  const existing = await prisma.paymentIssue.findUnique({ where: { id: issueId } });
  if (!existing) throw notFound("Payment issue");

  const updated = await prisma.paymentIssue.update({
    where: { id: issueId },
    data: { status, resolvedAt: new Date(), resolvedBy: session.email },
  });

  logger.info("payment_issue_closed", {
    issueId,
    type: existing.type,
    reference: existing.reference,
    status,
    adminId: session.adminId,
  });

  return ok(updated);
});
