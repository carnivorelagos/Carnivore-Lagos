import { logger } from "./logger";

/**
 * Optional coarse bounding box a delivery pin must fall inside, on top of
 * the origin + max-distance check. Catches garbage coordinates ((0,0), a
 * pin dropped in another country or in the ocean) before the fee math
 * runs, and gives a sane bound even if `maxDeliveryDistanceKm` is unset.
 *
 * Configured via `DELIVERY_AREA_BBOX` = "minLat,minLng,maxLat,maxLng".
 * Set it to `off` to disable the check entirely. Unset → a generous
 * Lagos-State default (this codebase is Lagos-centric: seed origin, map
 * default view, currency).
 */

export type Bounds = { minLat: number; minLng: number; maxLat: number; maxLng: number };

// ~Lagos State plus a wide margin (Badagry in the west to Epe/Ikorodu in
// the east, the lagoon and a strip of ocean to the south).
const LAGOS_DEFAULT: Bounds = { minLat: 6.2, minLng: 2.6, maxLat: 6.9, maxLng: 4.4 };

let cached: Bounds | null | undefined;

function parse(raw: string): Bounds | null {
  const parts = raw.split(",").map((p) => Number(p.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [minLat, minLng, maxLat, maxLng] = parts;
  if (minLat >= maxLat || minLng >= maxLng) return null;
  if (minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180) return null;
  return { minLat, minLng, maxLat, maxLng };
}

/** `null` means "no service-area check" (explicitly disabled). */
export function getServiceArea(): Bounds | null {
  if (cached !== undefined) return cached;

  const raw = process.env.DELIVERY_AREA_BBOX?.trim();
  if (!raw) {
    cached = LAGOS_DEFAULT;
  } else if (raw.toLowerCase() === "off") {
    cached = null;
  } else {
    const parsed = parse(raw);
    if (!parsed) {
      logger.error("delivery_area_bbox_invalid", { raw });
      cached = LAGOS_DEFAULT; // fail safe, not open
    } else {
      cached = parsed;
    }
  }
  return cached;
}

/** Test/hot-reload helper — forget the parsed value. */
export function resetServiceAreaCache(): void {
  cached = undefined;
}
