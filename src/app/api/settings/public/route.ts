import { NextRequest, NextResponse } from "next/server";
import { ok, withApiHandler } from "@/lib/api-response";
import { getSettings } from "@/lib/settings";
import { SETTINGS_REVALIDATE_SECONDS, catalogCdnHeaders } from "@/lib/cache";

/**
 * Non-sensitive checkout config only — never the origin coordinates or
 * the raw per-km rate, which stay server-side and are used only to
 * compute fees (Section: API contract). `getSettings()` is cached and
 * invalidated on admin save; CDN headers let the edge absorb repeats.
 */
export const GET = withApiHandler(async (_req: NextRequest) => {
  const settings = await getSettings();
  const res = ok({
    pickupEnabled: settings.pickupEnabled,
    deliveryEnabled: settings.deliveryEnabled,
    maxDeliveryDistanceKm: settings.maxDeliveryDistanceKm,
  });
  for (const [k, v] of Object.entries(catalogCdnHeaders(SETTINGS_REVALIDATE_SECONDS))) {
    res.headers.set(k, v);
  }
  return res as NextResponse;
});
