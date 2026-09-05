import { describe, it, expect } from "vitest";
import { subtotalKobo, deliveryFeeKobo, totalKobo, formatNaira } from "@/lib/money";

describe("money (Section 44 #2: server-side total calculation)", () => {
  it("sums line totals in integer kobo", () => {
    const subtotal = subtotalKobo([
      { unitPriceKobo: 350000, quantity: 2 },
      { unitPriceKobo: 150000, quantity: 1 },
    ]);
    expect(subtotal).toBe(350000 * 2 + 150000);
    expect(Number.isInteger(subtotal)).toBe(true);
  });

  it("rounds the delivery fee UP to the nearest kobo, not down", () => {
    // 2.37km * 150 kobo/km = 355.5 -> must become 356, never 355.
    const fee = deliveryFeeKobo(2.37, 150, 0);
    expect(fee).toBe(356);
  });

  it("applies the floor when the rate-based fee is below minDeliveryFeeKobo", () => {
    // 0.2km * 100 kobo/km = 20, floor is 500 -> floor wins.
    const fee = deliveryFeeKobo(0.2, 100, 500);
    expect(fee).toBe(500);
  });

  it("does not apply the floor when the rate-based fee already exceeds it", () => {
    const fee = deliveryFeeKobo(10, 150, 500); // 1500 > 500
    expect(fee).toBe(1500);
  });

  it("a zero rate produces a zero fee (pre-launch default) unless a floor is set", () => {
    expect(deliveryFeeKobo(5, 0, 0)).toBe(0);
    expect(deliveryFeeKobo(5, 0, 200)).toBe(200);
  });

  it("total is exactly subtotal + delivery fee, never a float", () => {
    const total = totalKobo(500000, 356);
    expect(total).toBe(500356);
    expect(Number.isInteger(total)).toBe(true);
  });

  it("formatNaira is display-only and renders whole and fractional kobo correctly", () => {
    expect(formatNaira(800000)).toBe("₦8,000.00");
    expect(formatNaira(150000)).toBe("₦1,500.00");
    expect(formatNaira(50)).toBe("₦0.50");
    expect(formatNaira(0)).toBe("₦0.00");
  });
});
