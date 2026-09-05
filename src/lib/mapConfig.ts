/**
 * Map / tile configuration, read from NEXT_PUBLIC_* env vars so switching
 * off OpenStreetMap's shared tile server (which is explicitly not for
 * production traffic — see DEPLOYMENT.md "Map tiles") is a config change,
 * not a code change.
 *
 * All values fall back to OSM + a Lagos default view, so the app still
 * works with nothing set. NEXT_PUBLIC_* vars are inlined at build time;
 * they must be referenced as full `process.env.NEXT_PUBLIC_...` literals,
 * not computed keys.
 */

const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const DEFAULT_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
// Lagos, roughly Ikeja — matches the seed's default restaurant origin.
const DEFAULT_CENTER: [number, number] = [6.5244, 3.3792];
const DEFAULT_ZOOM = 12;
const DEFAULT_MAX_ZOOM = 19;

function parseCenter(raw: string | undefined): [number, number] | null {
  if (!raw) return null;
  const parts = raw.split(",").map((p) => Number(p.trim()));
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null;
  const [lat, lng] = parts;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
}

function parseZoom(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 && n <= 22 ? Math.round(n) : fallback;
}

export const MAP_TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || DEFAULT_TILE_URL;

export const MAP_TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION || DEFAULT_ATTRIBUTION;

export const MAP_MAX_ZOOM = parseZoom(process.env.NEXT_PUBLIC_MAP_MAX_ZOOM, DEFAULT_MAX_ZOOM);

export const MAP_DEFAULT_CENTER: [number, number] =
  parseCenter(process.env.NEXT_PUBLIC_MAP_DEFAULT_CENTER) ?? DEFAULT_CENTER;

export const MAP_DEFAULT_ZOOM = parseZoom(process.env.NEXT_PUBLIC_MAP_DEFAULT_ZOOM, DEFAULT_ZOOM);

/** True when still pointing at OSM's shared server — used to warn in dev. */
export const MAP_USING_OSM_DEFAULT = MAP_TILE_URL === DEFAULT_TILE_URL;

if (MAP_USING_OSM_DEFAULT && process.env.NODE_ENV !== "production") {
  console.warn(
    "[map] Using the default OpenStreetMap tile server. Set NEXT_PUBLIC_MAP_TILE_URL to a keyed provider before production — see DEPLOYMENT.md 'Map tiles'.",
  );
}
