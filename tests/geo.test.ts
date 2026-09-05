import { describe, it, expect } from "vitest";
import { haversineDistanceKm } from "@/lib/geo";

describe("haversineDistanceKm", () => {
  it("returns ~0 for the same point", () => {
    const d = haversineDistanceKm({ lat: 6.5244, lng: 3.3792 }, { lat: 6.5244, lng: 3.3792 });
    expect(d).toBeCloseTo(0, 6);
  });

  it("matches a known real-world distance (Lagos Island to Lekki, ~roughly 10-15km)", () => {
    // Lagos Island (Marina) to Lekki Phase 1 gate, approximately.
    const d = haversineDistanceKm({ lat: 6.4531, lng: 3.3958 }, { lat: 6.4489, lng: 3.4732 });
    expect(d).toBeGreaterThan(5);
    expect(d).toBeLessThan(15);
  });

  it("is symmetric", () => {
    const a = { lat: 6.5, lng: 3.3 };
    const b = { lat: 6.6, lng: 3.5 };
    expect(haversineDistanceKm(a, b)).toBeCloseTo(haversineDistanceKm(b, a), 10);
  });
});
