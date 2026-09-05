import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireCustomer } from "@/lib/auth/requireCustomer";

/**
 * Web Push subscription registry. The browser (public/sw.js +
 * usePushSubscription) sends the PushSubscription JSON here after the user
 * opts in; DELETE removes it on opt-out or when the browser rotates it.
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
  const session = await requireCustomer(req);
  const { subscription } = subscribeSchema.parse(await req.json());
  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;

  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      customerId: session.customerId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent,
    },
    update: {
      // An endpoint can move to a different account (shared device) —
      // re-point it and refresh the keys.
      customerId: session.customerId,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent,
      lastUsedAt: new Date(),
    },
  });

  return ok({ saved: true });
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const session = await requireCustomer(req);
  const { endpoint } = unsubscribeSchema.parse(await req.json());
  await prisma.pushSubscription.deleteMany({
    where: { endpoint, customerId: session.customerId },
  });
  return ok({ removed: true });
});
