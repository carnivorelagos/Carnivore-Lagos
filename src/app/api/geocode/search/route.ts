import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, withApiHandler } from "@/lib/api-response";
import { enforceRateLimit, clientIp } from "@/lib/rateLimit";
import { getServiceArea, type Bounds } from "@/lib/serviceArea";
import { logger } from "@/lib/logger";

/**
 * Forward geocoding proxy — turns a typed delivery address into candidate
 * map locations, so a customer who TYPES their address (instead of tapping
 * the map or using "Use my location") still ends up with a pin, and
 * therefore a delivery fee and an enabled Pay button. Without a pin there
 * is nothing to price the delivery from.
 *
 * Same server-side-proxy reasoning as ./reverse (Nominatim's usage policy
 * wants a real User-Agent, which browsers can't set) and the same caveat:
 * fine at this scale, swap for a keyed provider before real traffic.
 *
 * Results are restricted to the delivery service area (Lagos by default),
 * so a stray "Victoria Island" can't resolve to somewhere else in the world.
 *
 * OSM knows streets and areas far better than house/plot numbers ("Road 12,
 * P-58B, Victoria Garden City" won't exist), and its free-text search is
 * strict: "Victoria Garden City" alone matches, but add "Lekki" and it
 * returns nothing. So when the full text finds nothing we retry with the
 * house/plot-number parts and the "Lagos"/"Nigeria" tail removed, then with
 * each named place on its own, and flag the result `approximate` — the
 * customer then drags the pin the last few metres.
 */

const querySchema = z.object({ q: z.string().trim().min(3).max(200) });

type NominatimHit = { display_name?: string; lat?: string; lon?: string };
type Suggestion = { label: string; lat: number; lng: number };

const UA = "CarnivoreLagos/1.0 (admin@carnivorelagos.com)";
const MAX_ATTEMPTS = 4;
// Nominatim's usage policy: at most ~1 request/second.
const GAP_MS = 1100;
const GENERIC_TAIL = /^(lagos( state)?|nigeria)$/i;
// A bare house / plot / road / block number — "12", "P-58B", "Road 12",
// "Plot 4B". These match random unrelated places when searched alone.
const NUMBER_ONLY =
  /^(no\.?\s*)?(road|rd|plot|block|house|flat|close|unit|apt)?\.?\s*[a-z]{0,2}-?\d+[a-z]?$/i;
const LEADING_NUMBER = /^\s*(no\.?\s*)?\d+[a-z]?\s*,?\s+/i;

/** Queries to try, most exact first. */
function buildAttempts(q: string): string[] {
  const parts = q.split(",").map((p) => p.trim()).filter(Boolean);
  // Named places worth searching on their own: drop "Lagos"/"Nigeria" and
  // bare numbers, and strip a leading house number ("12 Admiralty Way" ->
  // "Admiralty Way"). "Lekki Phase 1" stays — it's a place, not a number.
  const named = parts
    .filter((p) => !GENERIC_TAIL.test(p) && !NUMBER_ONLY.test(p))
    .map((p) => p.replace(LEADING_NUMBER, "").trim())
    .filter((p) => p.length >= 3);

  const attempts = [q];
  if (named.length >= 2) attempts.push(named.join(", "));
  for (const p of named) attempts.push(p);

  return [...new Set(attempts.map((a) => a.trim()).filter(Boolean))].slice(0, MAX_ATTEMPTS);
}

async function nominatim(q: string, area: Bounds | null): Promise<Suggestion[]> {
  const params = new URLSearchParams({
    format: "jsonv2",
    q,
    countrycodes: "ng",
    limit: "5",
    dedupe: "1",
    addressdetails: "0",
  });
  if (area) {
    // viewbox = left,top,right,bottom
    params.set("viewbox", `${area.minLng},${area.maxLat},${area.maxLng},${area.minLat}`);
    params.set("bounded", "1");
  }

  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "User-Agent": UA, "Accept-Language": "en" },
    signal: AbortSignal.timeout(2500),
  });
  if (!res.ok) {
    logger.warn("forward_geocode_failed", { status: res.status });
    return [];
  }
  const hits = (await res.json()) as NominatimHit[];
  const out: Suggestion[] = [];
  for (const h of hits) {
    const lat = Number(h.lat);
    const lng = Number(h.lon);
    if (!h.display_name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({ label: h.display_name, lat, lng });
  }
  return out;
}

export const GET = withApiHandler(async (req: NextRequest) => {
  await enforceRateLimit({ key: `geocode-search:${clientIp(req)}`, max: 30 });

  const { searchParams } = new URL(req.url);
  const { q } = querySchema.parse({ q: searchParams.get("q") });
  const area = getServiceArea();

  // Attempt 0 = the text as typed; later attempts loosen it (see above).
  const attempts = buildAttempts(q);

  let results: Suggestion[] = [];
  let approximate = false;
  try {
    for (let i = 0; i < attempts.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, GAP_MS));
      results = await nominatim(attempts[i], area);
      if (results.length > 0) {
        approximate = i > 0;
        break;
      }
    }
  } catch (err) {
    logger.warn("forward_geocode_failed", {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // Best-effort by design: no results just means the customer taps the map.
  return ok({ results, approximate });
});
