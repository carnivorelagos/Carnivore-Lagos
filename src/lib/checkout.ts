import { AppError, ErrorCode } from "./errors";
import { haversineDistanceKm, isWithinBounds } from "./geo";
import { deliveryFeeKobo as computeDeliveryFeeKobo, subtotalKobo, totalKobo } from "./money";

export type ServiceAreaBounds = { minLat: number; minLng: number; maxLat: number; maxLng: number };

/**
 * The exact fulfillment/range/floor validation sequence, in one place, so
 * /api/checkout/quote and POST /api/orders can never drift apart (that
 * drift was flagged explicitly during architecture review — this module
 * is the fix). Deliberately DB-independent: callers fetch
 * RestaurantSettings and the requested Products themselves and pass them
 * in, which is what makes this fully unit-testable without a live
 * database (Section 44).
 */

export type SettingsInput = {
  originLat: number | null;
  originLng: number | null;
  deliveryRatePerKmKobo: number;
  minDeliveryFeeKobo: number;
  maxDeliveryDistanceKm: number | null;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
};

export type ProductInput = {
  id: string;
  name: string;
  priceKobo: number;
  isActive: boolean;
  isAvailable: boolean;
};

export type CheckoutRequestInput = {
  fulfillmentType: "PICKUP" | "DELIVERY";
  items: { productId: string; quantity: number }[];
  deliveryPin?: { lat: number; lng: number };
};

export type CheckoutResult = {
  lineItems: {
    productId: string;
    productName: string;
    unitPriceKobo: number;
    quantity: number;
    lineTotalKobo: number;
  }[];
  subtotalKobo: number;
  deliveryFeeKobo: number;
  totalKobo: number;
  deliveryDistanceKm: number | null;
};

/**
 * Throws AppError for every failure mode this sequence is responsible for:
 * unavailable products, a disabled fulfillment type, a delivery pin
 * outside range, or a missing pin on a delivery order. Never trusts a
 * client-sent price — every unitPriceKobo comes from `products`, which
 * the caller must have fetched from the DB moments earlier.
 */
export function computeCheckout(
  input: CheckoutRequestInput,
  products: ProductInput[],
  settings: SettingsInput,
  serviceArea?: ServiceAreaBounds | null,
): CheckoutResult {
  // Step 0 — is this fulfillment type currently enabled?
  if (input.fulfillmentType === "PICKUP" && !settings.pickupEnabled) {
    throw new AppError(ErrorCode.FULFILLMENT_TYPE_UNAVAILABLE, "Pickup is not currently available.");
  }
  if (input.fulfillmentType === "DELIVERY" && !settings.deliveryEnabled) {
    throw new AppError(ErrorCode.FULFILLMENT_TYPE_UNAVAILABLE, "Delivery is not currently available.");
  }

  // Products: re-checked against current DB state, never the client's cart.
  const byId = new Map(products.map((p) => [p.id, p]));
  const unavailable: string[] = [];
  const lineItems: CheckoutResult["lineItems"] = [];

  for (const item of input.items) {
    const product = byId.get(item.productId);
    if (!product || !product.isActive || !product.isAvailable) {
      unavailable.push(item.productId);
      continue;
    }
    lineItems.push({
      productId: product.id,
      productName: product.name,
      unitPriceKobo: product.priceKobo,
      quantity: item.quantity,
      lineTotalKobo: product.priceKobo * item.quantity,
    });
  }

  if (unavailable.length > 0) {
    throw new AppError(
      ErrorCode.PRODUCT_UNAVAILABLE,
      "One or more selected products are unavailable.",
      { productIds: unavailable },
    );
  }

  const subtotal = subtotalKobo(lineItems);

  if (input.fulfillmentType === "PICKUP") {
    return {
      lineItems,
      subtotalKobo: subtotal,
      deliveryFeeKobo: 0,
      totalKobo: totalKobo(subtotal, 0),
      deliveryDistanceKm: null,
    };
  }

  // --- DELIVERY only from here ---

  // Step 1 — a pin is required. (Schema-level nullability exists only
  // because a pin is meaningless for PICKUP; it is never optional here.)
  if (!input.deliveryPin) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "A delivery pin is required for delivery orders.");
  }

  // Step 1b — coarse service-area check. Rejects garbage coordinates and
  // pins in another country / the ocean before any fee math, and bounds
  // things even when maxDeliveryDistanceKm is unset. `null` = disabled.
  if (serviceArea && !isWithinBounds(input.deliveryPin, serviceArea)) {
    throw new AppError(
      ErrorCode.DELIVERY_OUT_OF_RANGE,
      "That location is outside our delivery area. Try pickup or a closer address.",
    );
  }

  if (settings.originLat === null || settings.originLng === null) {
    // Admin hasn't configured the restaurant's origin yet — fail closed,
    // not with an invented distance.
    throw new AppError(
      ErrorCode.FULFILLMENT_TYPE_UNAVAILABLE,
      "Delivery is not currently configured. Please choose pickup.",
    );
  }

  // Step 2 — distance + max-range check.
  const distanceKm = haversineDistanceKm(
    { lat: settings.originLat, lng: settings.originLng },
    input.deliveryPin,
  );
  if (settings.maxDeliveryDistanceKm !== null && distanceKm > settings.maxDeliveryDistanceKm) {
    throw new AppError(
      ErrorCode.DELIVERY_OUT_OF_RANGE,
      "That address is outside our delivery range. Try pickup or a closer address.",
    );
  }

  // Step 3 — fee, rounded up, floored at minDeliveryFeeKobo.
  const fee = computeDeliveryFeeKobo(distanceKm, settings.deliveryRatePerKmKobo, settings.minDeliveryFeeKobo);

  return {
    lineItems,
    subtotalKobo: subtotal,
    deliveryFeeKobo: fee,
    totalKobo: totalKobo(subtotal, fee),
    deliveryDistanceKm: distanceKm,
  };
}
