import type { CartItem } from "@/components/providers/CartProvider";

/**
 * Checkout idempotency (Section 21). One key per checkout attempt, held
 * in sessionStorage so a refresh mid-flow reuses it (the backend then
 * returns the already-created order instead of a duplicate). The key is
 * bound to a snapshot hash of the cart + fulfillment: if the customer
 * goes back and changes the order, we mint a fresh key.
 */
const KEY = "carnivore_checkout";

type Stored = { idempotencyKey: string; hash: string };

export function cartHash(
  items: Pick<CartItem, "productId" | "quantity">[],
  fulfillmentType: string,
  pin: { lat: number; lng: number } | null,
): string {
  const parts = items
    .map((i) => `${i.productId}:${i.quantity}`)
    .sort()
    .join("|");
  const pinPart = pin ? `${pin.lat.toFixed(5)},${pin.lng.toFixed(5)}` : "none";
  return `${fulfillmentType}#${pinPart}#${parts}`;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback for older browsers.
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (
      Number(c) ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))
    ).toString(16),
  );
}

export function getIdempotencyKey(hash: string): string {
  let stored: Stored | null = null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) stored = JSON.parse(raw) as Stored;
  } catch {
    /* ignore */
  }
  if (stored && stored.hash === hash && stored.idempotencyKey) {
    return stored.idempotencyKey;
  }
  const fresh: Stored = { idempotencyKey: uuid(), hash };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(fresh));
  } catch {
    /* ignore */
  }
  return fresh.idempotencyKey;
}

export function clearCheckoutSession(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
