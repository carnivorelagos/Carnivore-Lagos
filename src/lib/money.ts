/**
 * All money math lives here, in integer kobo, per Section 4. Nothing in
 * this module ever touches a float for a stored/charged amount — the one
 * place a fractional value can appear is the intermediate product of
 * distanceKm × ratePerKmKobo, and that gets rounded to an integer before
 * it leaves this module.
 */

export function lineTotalKobo(unitPriceKobo: number, quantity: number): number {
  return unitPriceKobo * quantity;
}

export function subtotalKobo(items: { unitPriceKobo: number; quantity: number }[]): number {
  return items.reduce((sum, item) => sum + lineTotalKobo(item.unitPriceKobo, item.quantity), 0);
}

/**
 * deliveryFeeKobo = max(ceil(distanceKm × ratePerKmKobo), minDeliveryFeeKobo)
 *
 * Rounds UP to the nearest whole kobo before comparing against the floor —
 * distanceKm × ratePerKmKobo is a fractional product (Decimal × Int), and
 * deliveryFeeKobo is an Int (Section 4: integer minor units, never floats).
 * Rounding up rather than truncating means the restaurant is never
 * undercharged by a fraction of a kobo relative to what the rate/floor
 * calculation actually specifies.
 */
export function deliveryFeeKobo(
  distanceKm: number,
  ratePerKmKobo: number,
  minDeliveryFeeKobo: number,
): number {
  const raw = Math.ceil(distanceKm * ratePerKmKobo);
  return Math.max(raw, minDeliveryFeeKobo);
}

export function totalKobo(subtotal: number, deliveryFee: number): number {
  return subtotal + deliveryFee;
}

/**
 * Display-only formatting (e.g. the receipt email) — never used for any
 * stored or compared value, only for rendering an integer kobo amount as
 * "₦3,500.00" for a human to read.
 */
export function formatNaira(kobo: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(kobo / 100);
}
