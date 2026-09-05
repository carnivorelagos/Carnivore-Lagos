const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Straight-line (haversine) distance in km between two lat/lng points.
 * Deliberately not a road-network distance — that's the tradeoff behind
 * the "no geocoding/paid distance API" delivery-fee decision. Pure
 * function, no DB/network dependency, fully unit-testable.
 */
export function haversineDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}

/**
 * Point-in-bounding-box test for a lat/lng. Pure; used to reject
 * delivery pins that fall outside the configured service area before any
 * fee math runs (see src/lib/serviceArea.ts).
 */
export function isWithinBounds(
  point: { lat: number; lng: number },
  bounds: { minLat: number; minLng: number; maxLat: number; maxLng: number },
): boolean {
  return (
    point.lat >= bounds.minLat &&
    point.lat <= bounds.maxLat &&
    point.lng >= bounds.minLng &&
    point.lng <= bounds.maxLng
  );
}
