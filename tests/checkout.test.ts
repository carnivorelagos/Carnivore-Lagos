import { describe, it, expect } from "vitest";
import { computeCheckout, type ProductInput, type SettingsInput } from "@/lib/checkout";
import { AppError, ErrorCode } from "@/lib/errors";

const products: ProductInput[] = [
  { id: "p1", name: "Jollof Rice", priceKobo: 350000, isActive: true, isAvailable: true },
  { id: "p2", name: "Chapman", priceKobo: 150000, isActive: true, isAvailable: true },
  { id: "p3", name: "Discontinued Item", priceKobo: 999999, isActive: false, isAvailable: false },
  { id: "p4", name: "Sold Out Today", priceKobo: 200000, isActive: true, isAvailable: false },
];

const baseSettings: SettingsInput = {
  originLat: 6.5244,
  originLng: 3.3792,
  deliveryRatePerKmKobo: 150,
  minDeliveryFeeKobo: 300,
  maxDeliveryDistanceKm: 15,
  pickupEnabled: true,
  deliveryEnabled: true,
};

describe("computeCheckout — Section 44 #2 server-side totals, #10 unavailable products, #11 price tampering", () => {
  it("computes totals from DB prices only — client cannot influence price (#11)", () => {
    const result = computeCheckout(
      { fulfillmentType: "PICKUP", items: [{ productId: "p1", quantity: 2 }] },
      products,
      baseSettings,
    );
    // The input type has no price field at all — there is structurally no
    // way for a client to pass a price. This assertion just documents
    // that the trusted price is p1's DB priceKobo, not anything supplied.
    expect(result.subtotalKobo).toBe(700000);
    expect(result.totalKobo).toBe(700000);
    expect(result.deliveryFeeKobo).toBe(0);
  });

  it("rejects a cart containing an inactive product, with no partial success (#10)", () => {
    expect(() =>
      computeCheckout(
        { fulfillmentType: "PICKUP", items: [{ productId: "p1", quantity: 1 }, { productId: "p3", quantity: 1 }] },
        products,
        baseSettings,
      ),
    ).toThrowError(AppError);

    try {
      computeCheckout(
        { fulfillmentType: "PICKUP", items: [{ productId: "p1", quantity: 1 }, { productId: "p3", quantity: 1 }] },
        products,
        baseSettings,
      );
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe(ErrorCode.PRODUCT_UNAVAILABLE);
      expect((e as AppError).details).toEqual({ productIds: ["p3"] });
    }
  });

  it("rejects a cart with a temporarily-unavailable (but still active) product", () => {
    expect(() =>
      computeCheckout(
        { fulfillmentType: "PICKUP", items: [{ productId: "p4", quantity: 1 }] },
        products,
        baseSettings,
      ),
    ).toThrowError(AppError);
  });

  it("rejects an unknown product id the same way as an unavailable one", () => {
    expect(() =>
      computeCheckout(
        { fulfillmentType: "PICKUP", items: [{ productId: "does-not-exist", quantity: 1 }] },
        products,
        baseSettings,
      ),
    ).toThrowError(AppError);
  });

  it("rejects PICKUP when pickupEnabled is false", () => {
    try {
      computeCheckout(
        { fulfillmentType: "PICKUP", items: [{ productId: "p1", quantity: 1 }] },
        products,
        { ...baseSettings, pickupEnabled: false },
      );
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.FULFILLMENT_TYPE_UNAVAILABLE);
    }
  });

  it("rejects DELIVERY when deliveryEnabled is false", () => {
    try {
      computeCheckout(
        { fulfillmentType: "DELIVERY", items: [{ productId: "p1", quantity: 1 }], deliveryPin: { lat: 6.5, lng: 3.4 } },
        products,
        { ...baseSettings, deliveryEnabled: false },
      );
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.FULFILLMENT_TYPE_UNAVAILABLE);
    }
  });

  it("rejects DELIVERY with no pin, even if deliveryEnabled — a malformed request (#12 malformed data)", () => {
    try {
      computeCheckout(
        { fulfillmentType: "DELIVERY", items: [{ productId: "p1", quantity: 1 }] },
        products,
        baseSettings,
      );
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.VALIDATION_ERROR);
    }
  });

  it("rejects a delivery pin outside maxDeliveryDistanceKm", () => {
    try {
      computeCheckout(
        {
          fulfillmentType: "DELIVERY",
          items: [{ productId: "p1", quantity: 1 }],
          // Roughly 100+ km away from the origin.
          deliveryPin: { lat: 7.5, lng: 4.5 },
        },
        products,
        baseSettings,
      );
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.DELIVERY_OUT_OF_RANGE);
    }
  });

  it("accepts an in-range delivery and returns subtotal + fee + total + distance", () => {
    const result = computeCheckout(
      {
        fulfillmentType: "DELIVERY",
        items: [{ productId: "p1", quantity: 1 }],
        deliveryPin: { lat: 6.53, lng: 3.39 }, // close to origin
      },
      products,
      baseSettings,
    );
    expect(result.subtotalKobo).toBe(350000);
    expect(result.deliveryDistanceKm).not.toBeNull();
    expect(result.deliveryFeeKobo).toBeGreaterThanOrEqual(baseSettings.minDeliveryFeeKobo);
    expect(result.totalKobo).toBe(result.subtotalKobo + result.deliveryFeeKobo);
  });

  it("fails closed (not with an invented distance) when delivery is enabled but no origin is configured", () => {
    try {
      computeCheckout(
        { fulfillmentType: "DELIVERY", items: [{ productId: "p1", quantity: 1 }], deliveryPin: { lat: 6.5, lng: 3.4 } },
        products,
        { ...baseSettings, originLat: null, originLng: null },
      );
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as AppError).code).toBe(ErrorCode.FULFILLMENT_TYPE_UNAVAILABLE);
    }
  });
});
