import { describe, it, expect } from "vitest";
import { isValidTransition, allowedNextStatuses } from "@/lib/orderStateMachine";

describe("order state machine — Section 44 #9 invalid transitions", () => {
  it("allows the documented forward path", () => {
    expect(isValidTransition("PAID", "CONFIRMED")).toBe(true);
    expect(isValidTransition("CONFIRMED", "PREPARING")).toBe(true);
    expect(isValidTransition("PREPARING", "READY")).toBe(true);
    expect(isValidTransition("READY", "COMPLETED")).toBe(true);
  });

  it("rejects skipping straight from PAID to READY", () => {
    expect(isValidTransition("PAID", "READY")).toBe(false);
  });

  it("rejects every reverse transition", () => {
    expect(isValidTransition("COMPLETED", "PENDING_PAYMENT")).toBe(false);
    expect(isValidTransition("READY", "PREPARING")).toBe(false);
    expect(isValidTransition("CONFIRMED", "PAID")).toBe(false);
    expect(isValidTransition("PAID", "PENDING_PAYMENT")).toBe(false);
  });

  it("PENDING_PAYMENT can only ever be cancelled, never marked PAID directly by this table", () => {
    expect(allowedNextStatuses("PENDING_PAYMENT")).toEqual(["CANCELLED"]);
  });

  it("COMPLETED and CANCELLED are terminal — no transitions out", () => {
    expect(allowedNextStatuses("COMPLETED")).toEqual([]);
    expect(allowedNextStatuses("CANCELLED")).toEqual([]);
  });

  it("CANCELLED is unreachable from PREPARING or READY (exceptional cancellation window has closed)", () => {
    expect(isValidTransition("PREPARING", "CANCELLED")).toBe(false);
    expect(isValidTransition("READY", "CANCELLED")).toBe(false);
  });

  it("rejects a made-up status string at the type boundary (compile-time), and rejects any unlisted pair at runtime", () => {
    // @ts-expect-error - intentionally invalid status to prove runtime safety too
    expect(isValidTransition("PAID", "SHIPPED")).toBe(false);
  });
});
