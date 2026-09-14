import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, withApiHandler } from "@/lib/api-response";
import { enforceRateLimit, clientIp } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";

/**
 * Reverse geocoding proxy — turns a delivery pin into a human-readable
 * address to auto-fill the checkout address field (better UX than making
 * the customer type an address that must match a pin they already placed).
 *
 * Proxied server-side, not called directly from the browser, for one
 * reason: Nominatim's usage policy requires a real identifying User-Agent,
 * and browsers refuse to let `fetch` set that header. Same free OSM
 * service the map tiles already use (DEPLOYMENT.md "Map tiles") — same
 * caveat applies: fine at this scale, swap for a keyed provider
 * (MapTiler/Mapbox/Stadia all offer reverse geocoding too) before real
 * traffic. Rate-limited per IP on top of Nominatim's own ~1req/s policy.
 */

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

type NominatimReverseResponse = {
  display_name?: string;
  address?: Record<string, string>;
};

export const GET = withApiHandler(async (req: NextRequest) => {
  await enforceRateLimit({ key: `geocode:${clientIp(req)}`, max: 20 });

  const { searchParams } = new URL(req.url);
  const { lat, lng } = querySchema.parse({
    lat: searchParams.get("lat"),
    lng: searchParams.get("lng"),
  });

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=0`;

  let address: string | null = null;
  try {
    const res = await fetch(url, {
      headers: {
        // Nominatim's usage policy requires a real identifying UA — this
        // is exactly why the call happens server-side, not from the browser.
        "User-Agent": "CarnivoreLagos/1.0 (admin@carnivorelagos.com)",
        "Accept-Language": "en",
      },
    });
    if (res.ok) {
      const body = (await res.json()) as NominatimReverseResponse;
      address = body.display_name ?? null;
    } else {
      logger.warn("reverse_geocode_failed", { status: res.status });
    }
  } catch (err) {
    logger.warn("reverse_geocode_failed", {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // Best-effort by design — a failed lookup just means the customer types
  // the address themselves, same as before this existed.
  return ok({ address });
});
