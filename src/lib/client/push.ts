import { savePushSubscription, deletePushSubscription } from "./endpoints";

type PushSubJSON = { endpoint: string; keys: { p256dh: string; auth: string } };
type SaveFn = (sub: PushSubJSON) => Promise<unknown>;
type RemoveFn = (endpoint: string) => Promise<unknown>;

/**
 * Browser-side Web Push wiring. All of this is a no-op when the VAPID
 * public key isn't configured or the browser doesn't support push, so
 * callers can use it unconditionally and just check `pushSupported()`.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    VAPID_PUBLIC_KEY.length > 0
  );
}

export function pushPermission(): NotificationPermission | "unsupported" {
  if (!pushSupported()) return "unsupported";
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

function toJSON(sub: PushSubscription): { endpoint: string; keys: { p256dh: string; auth: string } } {
  const json = sub.toJSON();
  return {
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
  };
}

/**
 * Ask permission, subscribe this browser, and persist server-side.
 * Defaults to the customer endpoints; pass the admin `save` fn to register
 * the same browser for admin alerts instead. Returns true on success.
 */
export async function enablePush(save: SaveFn = savePushSubscription): Promise<boolean> {
  if (!pushSupported()) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const reg = await getRegistration();
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  await save(toJSON(sub));
  return true;
}

/**
 * Remove this browser's server-side registration. Only unsubscribes the
 * browser-level push when `hardUnsubscribe` is true — a shared browser may
 * still be registered for the other role (customer vs admin).
 */
export async function disablePush(
  remove: RemoveFn = deletePushSubscription,
  hardUnsubscribe = true,
): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;

  const endpoint = sub.endpoint;
  await remove(endpoint).catch(() => undefined);
  if (hardUnsubscribe) {
    try {
      await sub.unsubscribe();
    } catch {
      /* ignore */
    }
  }
}

/** True if this browser currently holds an active push subscription. */
export async function isPushSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  return Boolean(sub);
}
