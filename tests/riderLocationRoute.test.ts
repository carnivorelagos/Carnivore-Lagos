import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Mocks collaborators so this exercises only the route's own visibility
// logic (fulfillment type, status, staleness), not a real database.
const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { order: { findUnique } } }));

import { GET as getRiderLocation } from "../src/app/api/orders/[slug]/rider/route";

const ctx = { params: Promise.resolve({ slug: "abc123" }) };
const req = () => new NextRequest("https://www.carnivorelagos.com/api/orders/abc123/rider");

const baseOrder = {
  status: "OUT_FOR_DELIVERY" as const,
  fulfillmentType: "DELIVERY" as const,
  deliveryLat: "6.5244" as unknown as number,
  deliveryLng: "3.3792" as unknown as number,
  rider: { name: "Tunde", lastLat: "6.5" as unknown as number, lastLng: "3.4" as unknown as number, lastSeenAt: new Date() },
};

beforeEach(() => {
  findUnique.mockReset();
});

async function body(res: Response) {
  return (await res.json()).data;
}

describe("GET /api/orders/[slug]/rider", () => {
  it("404s for an unknown order", async () => {
    findUnique.mockResolvedValueOnce(null);
    const res = await getRiderLocation(req(), ctx);
    expect(res.status).toBe(404);
  });

  it("returns the rider's fresh position plus the destination once out for delivery", async () => {
    findUnique.mockResolvedValueOnce(baseOrder);
    const data = await body(await getRiderLocation(req(), ctx));
    expect(data.rider).toEqual({ name: "Tunde", lat: 6.5, lng: 3.4, lastSeenAt: expect.any(String) });
    expect(data.destination).toEqual({ lat: 6.5244, lng: 3.3792 });
  });

  it("hides the rider (but keeps the destination) before out-for-delivery", async () => {
    findUnique.mockResolvedValueOnce({ ...baseOrder, status: "READY" });
    const data = await body(await getRiderLocation(req(), ctx));
    expect(data.rider).toBeNull();
    expect(data.destination).toEqual({ lat: 6.5244, lng: 3.3792 });
  });

  it("hides the rider on a pickup order even if one is somehow set", async () => {
    findUnique.mockResolvedValueOnce({ ...baseOrder, fulfillmentType: "PICKUP" });
    const data = await body(await getRiderLocation(req(), ctx));
    expect(data.rider).toBeNull();
  });

  it("hides a stale position instead of showing a misleading marker", async () => {
    findUnique.mockResolvedValueOnce({
      ...baseOrder,
      rider: { ...baseOrder.rider, lastSeenAt: new Date(Date.now() - 10 * 60_000) },
    });
    const data = await body(await getRiderLocation(req(), ctx));
    expect(data.rider).toBeNull();
  });

  it("returns null for both when no rider is assigned yet", async () => {
    findUnique.mockResolvedValueOnce({ ...baseOrder, rider: null, deliveryLat: null, deliveryLng: null });
    const data = await body(await getRiderLocation(req(), ctx));
    expect(data.rider).toBeNull();
    expect(data.destination).toBeNull();
  });

  it("never includes the rider's phone number", async () => {
    findUnique.mockResolvedValueOnce(baseOrder);
    const data = await body(await getRiderLocation(req(), ctx));
    expect(data.rider).not.toHaveProperty("phone");
  });
});
