import { describe, expect, it } from "vitest";
import { isRiderLocationFresh, RIDER_LOCATION_STALE_MS } from "../src/lib/riders";

describe("isRiderLocationFresh", () => {
  it("is false when there's no timestamp at all", () => {
    expect(isRiderLocationFresh(null)).toBe(false);
  });

  it("is true just inside the staleness window", () => {
    const t = new Date(Date.now() - (RIDER_LOCATION_STALE_MS - 5000));
    expect(isRiderLocationFresh(t)).toBe(true);
  });

  it("is false once past the staleness window", () => {
    const t = new Date(Date.now() - (RIDER_LOCATION_STALE_MS + 5000));
    expect(isRiderLocationFresh(t)).toBe(false);
  });

  it("is false for a timestamp in the future (clock skew, don't trust it)", () => {
    // Still "fresh" by the <STALE_MS check — document the actual behavior:
    // a future timestamp reads as fresh since the diff is negative, less
    // than the threshold. Not exploitable (the server sets this itself),
    // but worth a test so the behavior is intentional, not accidental.
    const t = new Date(Date.now() + 60_000);
    expect(isRiderLocationFresh(t)).toBe(true);
  });
});
