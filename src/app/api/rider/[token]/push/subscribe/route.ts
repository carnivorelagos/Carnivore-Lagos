import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { assertSameOrigin } from "@/lib/auth/csrf";
import { notFound } from "@/lib/errors";
import { riderTokenSchema } from "@/lib/validation";

/**
 * Web Push subscription registry for a rider's own tracking link — same
 * shape as /api/me/push/subscribe and /api/admin/push/subscribe, written
 * to RiderPushSubscription and guarded by the token instead of a session.
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

export const POST = withApiHandler(async (req: NextRequest, ctx) => {
  assertSameOrigin(req);
  const { token } = await ctx.params;
  const parsed = riderTokenSchema.safeParse(token);
  if (!parsed.success) throw notFound("Rider");

  const rider = await prisma.rider.findUnique({ where: { token: parsed.data } });
  if (!rider || !rider.isActive) throw notFound("Rider");

  const { subscription } = subscribeSchema.parse(await req.json());
  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;

  await prisma.riderPushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      riderId: rider.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent,
    },
    update: {
      riderId: rider.id,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent,
      lastUsedAt: new Date(),
    },
  });

  return ok({ saved: true });
});

export const DELETE = withApiHandler(async (req: NextRequest, ctx) => {
  assertSameOrigin(req);
  const { token } = await ctx.params;
  const parsed = riderTokenSchema.safeParse(token);
  if (!parsed.success) throw notFound("Rider");

  const rider = await prisma.rider.findUnique({ where: { token: parsed.data } });
  if (!rider) throw notFound("Rider");

  const { endpoint } = unsubscribeSchema.parse(await req.json());
  await prisma.riderPushSubscription.deleteMany({ where: { endpoint, riderId: rider.id } });
  return ok({ removed: true });
});
