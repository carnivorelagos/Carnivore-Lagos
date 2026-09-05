import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireCustomer } from "@/lib/auth/requireCustomer";
import { uuidSchema } from "@/lib/validation";
import { notFound } from "@/lib/errors";

/** Mark one notification read (idempotent). 404 if it isn't this customer's. */
export const PATCH = withApiHandler(async (req: NextRequest, ctx) => {
  const session = await requireCustomer(req);
  const { id } = await ctx.params;
  const notificationId = uuidSchema.parse(id);

  const res = await prisma.notification.updateMany({
    where: { id: notificationId, customerId: session.customerId },
    data: { readAt: new Date() },
  });
  if (res.count === 0) throw notFound("Notification");

  return ok({ read: true });
});
