import { describe, it, expect } from "vitest";
import { phoneSchema, cartItemsSchema, checkoutBaseSchema } from "@/lib/validation";

describe("phoneSchema — Section 11 realistic Nigerian formats", () => {
  it("accepts +234 format", () => {
    expect(phoneSchema.parse("+2348012345678")).toBe("+2348012345678");
  });
  it("accepts local 0-prefixed format", () => {
    expect(phoneSchema.parse("08012345678")).toBe("08012345678");
  });
  it("strips spaces and dashes before validating", () => {
    expect(phoneSchema.parse("0801 234 5678")).toBe("08012345678");
    expect(phoneSchema.parse("0801-234-5678")).toBe("08012345678");
  });
  it("rejects a too-short number", () => {
    expect(() => phoneSchema.parse("08012345")).toThrow();
  });
  it("rejects a non-Nigerian looking number", () => {
    expect(() => phoneSchema.parse("+14155552671")).toThrow();
  });
});

describe("cartItemsSchema — Section 11 oversized quantity/cart limits", () => {
  it("rejects a quantity above the per-item max", () => {
    expect(() => cartItemsSchema.parse([{ productId: crypto.randomUUID(), quantity: 999 }])).toThrow();
  });
  it("rejects more than the max distinct items", () => {
    const items = Array.from({ length: 40 }, () => ({ productId: crypto.randomUUID(), quantity: 1 }));
    expect(() => cartItemsSchema.parse(items)).toThrow();
  });
  it("accepts a reasonable cart", () => {
    const items = [{ productId: crypto.randomUUID(), quantity: 3 }];
    expect(cartItemsSchema.parse(items)).toHaveLength(1);
  });
});

describe("checkoutBaseSchema — malformed data rejection", () => {
  const validBase = {
    fulfillmentType: "PICKUP" as const,
    items: [{ productId: crypto.randomUUID(), quantity: 1 }],
    customerName: "Ada",
    customerPhone: "08012345678",
  };

  it("accepts a well-formed pickup request", () => {
    expect(() => checkoutBaseSchema.parse(validBase)).not.toThrow();
  });

  it("rejects DELIVERY with no deliveryPin", () => {
    expect(() => checkoutBaseSchema.parse({ ...validBase, fulfillmentType: "DELIVERY" })).toThrow();
  });

  it("accepts DELIVERY when a deliveryPin is present", () => {
    expect(() =>
      checkoutBaseSchema.parse({ ...validBase, fulfillmentType: "DELIVERY", deliveryPin: { lat: 6.5, lng: 3.4 } }),
    ).not.toThrow();
  });

  it("rejects an unknown fulfillmentType", () => {
    expect(() => checkoutBaseSchema.parse({ ...validBase, fulfillmentType: "TELEPORT" })).toThrow();
  });

  it("rejects a wildly out-of-range latitude", () => {
    expect(() =>
      checkoutBaseSchema.parse({ ...validBase, fulfillmentType: "DELIVERY", deliveryPin: { lat: 999, lng: 3.4 } }),
    ).toThrow();
  });
});
