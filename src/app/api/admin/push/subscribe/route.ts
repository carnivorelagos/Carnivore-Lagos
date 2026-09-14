import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/requireAdmin";

/**
 * Admin Web Push subscription registry — the delivery addresses for
 * real-time "new paid order" alerts. Same shape as /api/me/push/subscribe
 * but written to AdminPushSubscription and guarded by the admin session.
 */

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(1000),
    keys: z.object({
      p256dh: z.string().min(1).max(500),
      auth: z.string().min(1).max(500),
    }),
  }),
});

const unsubscribeSchema = z.object({ endpoint: z.string().url().max(1000) });

export const POST = withApiHandler(async (req: NextRequest) => {
  const session = await requireAdmin(req);
  const { subscription } = subscribeSchema.parse(await req.json());
  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;

  await prisma.adminPushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      adminUserId: session.adminId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent,
    },
    update: {
      // An endpoint can move to a different admin (shared browser) —
      // re-point it and refresh the keys.
      adminUserId: session.adminId,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent,
      lastUsedAt: new Date(),
    },
  });

  return ok({ saved: true });
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const session = await requireAdmin(req);
  const { endpoint } = unsubscribeSchema.parse(await req.json());
  await prisma.adminPushSubscription.deleteMany({
    where: { endpoint, adminUserId: session.adminId },
  });
  return ok({ removed: true });
});
