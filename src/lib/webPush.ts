import webpush from "web-push";
import { prisma } from "./prisma";
import { logger } from "./logger";

/**
 * Web Push (VAPID) — no Firebase. The browser subscribes via the service
 * worker (public/sw.js) and POSTs its subscription to
 * /api/me/push/subscribe; this module signs and delivers payloads to the
 * push service. All sends are best-effort: a dead subscription (404/410)
 * is pruned, anything else is logged and swallowed.
 *
 * Disabled cleanly when the VAPID env vars are absent — every function
 * becomes a no-op, so the rest of the notification pipeline is unaffected.
 */

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  } catch (err) {
    logger.error("web_push_vapid_config_failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    configured = false;
  }
  return configured;
}

export function webPushEnabled(): boolean {
  return ensureConfigured();
}

/** Fan a payload out to every device a customer has subscribed. */
export async function sendWebPushToCustomer(customerId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return;

  const subs = await prisma.pushSubscription
    .findMany({ where: { customerId } })
    .catch(() => [] as { id: string; endpoint: string; p256dh: string; auth: string }[]);

  if (subs.length === 0) return;

  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
          { TTL: 60 * 60 * 12 },
        );
        await prisma.pushSubscription
          .update({ where: { id: sub.id }, data: { lastUsedAt: new Date() } })
          .catch(() => undefined);
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription is gone — prune it.
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
          logger.info("web_push_subscription_pruned", { customerId, statusCode });
        } else {
          logger.error("web_push_send_failed", {
            customerId,
            statusCode,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }),
  );
}

/**
 * Fan a payload out to every browser every admin has opted in on — the
 * real-time "new paid order" alert for the kitchen. Separate table from
 * the customer subs so a shared browser never gets the wrong payload.
 */
export async function sendWebPushToAdmins(payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return;

  const subs = await prisma.adminPushSubscription
    .findMany()
    .catch(() => [] as { id: string; endpoint: string; p256dh: string; auth: string }[]);

  if (subs.length === 0) return;

  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
          { TTL: 60 * 60 * 6 },
        );
        await prisma.adminPushSubscription
          .update({ where: { id: sub.id }, data: { lastUsedAt: new Date() } })
          .catch(() => undefined);
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.adminPushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
          logger.info("admin_web_push_subscription_pruned", { statusCode });
        } else {
          logger.error("admin_web_push_send_failed", {
            statusCode,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }),
  );
}

/** Best-effort cleanup for the reconcile cron — drop very stale subs. */
export async function prunePushSubscriptions(olderThanDays = 120): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const [customer, admin] = await Promise.all([
    prisma.pushSubscription.deleteMany({ where: { lastUsedAt: { lt: cutoff } } }).catch(() => ({ count: 0 })),
    prisma.adminPushSubscription.deleteMany({ where: { lastUsedAt: { lt: cutoff } } }).catch(() => ({ count: 0 })),
  ]);
  return customer.count + admin.count;
}
