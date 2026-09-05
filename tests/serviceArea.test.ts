import { describe, it, expect, afterEach } from "vitest";
import { isWithinBounds } from "@/lib/geo";
import { getServiceArea, resetServiceAreaCache } from "@/lib/serviceArea";
import { computeCheckout, type ProductInput, type SettingsInput } from "@/lib/checkout";
import { AppError, ErrorCode } from "@/lib/errors";

const LAGOS = { minLat: 6.2, minLng: 2.6, maxLat: 6.9, maxLng: 4.4 };

describe("isWithinBounds", () => {
  it("accepts a point inside the box (Lagos Island)", () => {
    expect(isWithinBounds({ lat: 6.4531, lng: 3.3958 }, LAGOS)).toBe(true);
  });
  it("rejects (0,0) — the classic garbage coordinate", () => {
    expect(isWithinBounds({ lat: 0, lng: 0 }, LAGOS)).toBe(false);
  });
  it("rejects a point in another country (Accra)", () => {
    expect(isWithinBounds({ lat: 5.6037, lng: -0.187 }, LAGOS)).toBe(false);
  });
  it("treats the boundary as inclusive", () => {
    expect(isWithinBounds({ lat: 6.2, lng: 2.6 }, LAGOS)).toBe(true);
  });
});

describe("getServiceArea", () => {
  afterEach(() => {
    delete process.env.DELIVERY_AREA_BBOX;
    resetServiceAreaCache();
  });

  it("defaults to a Lagos box when unset", () => {
    resetServiceAreaCache();
    expect(getServiceArea()).toEqual(LAGOS);
  });

  it("parses a custom bbox", () => {
    process.env.DELIVERY_AREA_BBOX = "1,2,3,4";
    resetServiceAreaCache();
    expect(getServiceArea()).toEqual({ minLat: 1, minLng: 2, maxLat: 3, maxLng: 4 });
  });

  it("returns null when explicitly disabled", () => {
    process.env.DELIVERY_AREA_BBOX = "off";
    resetServiceAreaCache();
    expect(getServiceArea()).toBeNull();
  });

  it("fails safe (Lagos default, not open) on a malformed value", () => {
    process.env.DELIVERY_AREA_BBOX = "not,a,bbox";
    resetServiceAreaCache();
    expect(getServiceArea()).toEqual(LAGOS);
  });
});

describe("computeCheckout — service-area gate", () => {
  const products: ProductInput[] = [
    { id: "p1", name: "Jollof", priceKobo: 350000, isActive: true, isAvailable: true },
  ];
  const settings: SettingsInput = {
    originLat: 6.5244,
    originLng: 3.3792,
    deliveryRatePerKmKobo: 150,
    minDeliveryFeeKobo: 300,
    maxDeliveryDistanceKm: 15,
    pickupEnabled: true,
    deliveryEnabled: true,
  };

  it("rejects a delivery pin outside the service area before fee math", () => {
    try {
      computeCheckout(
        {
          fulfillmentType: "DELIVERY",
          items: [{ productId: "p1", quantity: 1 }],
          deliveryPin: { lat: 0, lng: 0 },
        },
        products,
        settings,
        LAGOS,
      );
      throw new Error("expected a throw");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe(ErrorCode.DELIVERY_OUT_OF_RANGE);
    }
  });

  it("allows an in-area pin (and still applies the normal distance/fee rules)", () => {
    const result = computeCheckout(
      {
        fulfillmentType: "DELIVERY",
        items: [{ productId: "p1", quantity: 1 }],
        deliveryPin: { lat: 6.53, lng: 3.39 },
      },
      products,
      settings,
      LAGOS,
    );
    expect(result.deliveryFeeKobo).toBeGreaterThan(0);
  });

  it("skips the check when serviceArea is null/omitted", () => {
    const result = computeCheckout(
      {
        fulfillmentType: "DELIVERY",
        items: [{ productId: "p1", quantity: 1 }],
        deliveryPin: { lat: 6.53, lng: 3.39 },
      },
      products,
      settings,
      null,
    );
    expect(result.deliveryDistanceKm).not.toBeNull();
  });
});
