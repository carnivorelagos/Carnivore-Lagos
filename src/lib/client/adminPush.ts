import { enablePush, disablePush } from "./push";
import { saveAdminPushSubscription, deleteAdminPushSubscription } from "./endpoints";

export { pushSupported, pushPermission, isPushSubscribed } from "./push";

/** Opt this browser in to real-time new-order alerts. Returns true on success. */
export function enableAdminPush(): Promise<boolean> {
  return enablePush(saveAdminPushSubscription);
}

/**
 * Remove this browser's admin alert registration. Keeps the browser-level
 * push subscription (it may still be in use for customer notifications on
 * a shared browser).
 */
export function disableAdminPush(): Promise<void> {
  return disablePush(deleteAdminPushSubscription, false);
}
