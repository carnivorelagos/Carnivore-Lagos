/**
 * Shared by every reader of a rider's live position (the customer-facing
 * /api/orders/[slug]/rider route and the admin order detail page): a
 * position older than this is treated as "not currently sharing" rather
 * than shown as a possibly-stale marker on a map. Generous enough to
 * survive one missed heartbeat (the rider page sends roughly every 15s)
 * plus normal network hiccups, tight enough that a rider who closed the
 * tab or lost signal stops looking "live" within a couple of minutes.
 */
export const RIDER_LOCATION_STALE_MS = 3 * 60_000;

export function isRiderLocationFresh(lastSeenAt: Date | null): boolean {
  return !!lastSeenAt && Date.now() - lastSeenAt.getTime() < RIDER_LOCATION_STALE_MS;
}

/** Order statuses during which a customer should be shown a live rider map. */
export const RIDER_TRACKING_VISIBLE_STATUSES = new Set(["OUT_FOR_DELIVERY"]);
