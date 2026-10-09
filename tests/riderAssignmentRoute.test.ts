import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Exercises only the route's own decision logic (when to notify, when
// not to) — every collaborator that touches the database/network/email/
// push is mocked.
const {
  orderFindUnique,
  orderUpdate,
  riderFindUnique,
  sendEmail,
  sendPush,
} = vi.hoisted(() => ({
  orderFindUnique: vi.fn(),
  orderUpdate: vi.fn(),
  riderFindUnique: vi.fn(),
  sendEmail: vi.fn(async () => {}),
  sendPush: vi.fn(async () => {}),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findUnique: orderFindUnique, update: orderUpdate },
    rider: { findUnique: riderFindUnique },
  },
}));
vi.mock("@/lib/auth/requireAdmin", () => ({ requireAdmin: vi.fn(async () => ({ adminId: "a1", role: "ADMIN" })) }));
vi.mock("@/lib/email", () => ({ sendRiderAssignmentEmail: sendEmail }));
vi.mock("@/lib/webPush", () => ({ sendWebPushToRider: sendPush }));

import { PATCH as assignRider } from "../src/app/api/admin/orders/[id]/rider/route";

const ORDER_ID = "11111111-1111-1111-1111-111111111111";
const RIDER_ID = "22222222-2222-2222-2222-222222222222";
const ctx = { params: Promise.resolve({ id: ORDER_ID }) };

const baseOrder = {
  id: ORDER_ID,
  riderId: null as string | null,
  deletedAt: null as Date | null,
  fulfillmentType: "DELIVERY" as const,
  orderNumber: "CL-1042",
  customerName: "Ada",
  deliveryAddress: "12 Admiralty Way",
};

const activeRider = {
  id: RIDER_ID,
  name: "Tunde",
  email: "tunde@example.com",
  token: "rider-token-abc",
  isActive: true,
};

function req(body: unknown) {
  return new NextRequest(`https://www.carnivorelagos.com/api/admin/orders/${ORDER_ID}/rider`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  orderFindUnique.mockReset();
  orderUpdate.mockReset();
  riderFindUnique.mockReset();
  sendEmail.mockClear();
  sendPush.mockClear();
  orderUpdate.mockImplementation(async ({ data }: { data: { riderId: string | null } }) => ({
    ...baseOrder,
    riderId: data.riderId,
    rider: data.riderId ? activeRider : null,
    items: [],
    payment: null,
  }));
});

describe("PATCH /api/admin/orders/[id]/rider", () => {
  it("notifies the rider (email + push) on a genuine new assignment", async () => {
    orderFindUnique.mockResolvedValueOnce(baseOrder);
    riderFindUnique.mockResolvedValueOnce(activeRider);

    const res = await assignRider(req({ riderId: RIDER_ID }), ctx);
    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      "tunde@example.com",
      expect.objectContaining({ orderNumber: "CL-1042", link: expect.stringContaining("/rider/rider-token-abc") }),
    );
    expect(sendPush).toHaveBeenCalledTimes(1);
    expect(sendPush).toHaveBeenCalledWith(RIDER_ID, expect.objectContaining({ title: "New delivery" }));
  });

  it("skips the email when the rider has none on file, but still sends push", async () => {
    orderFindUnique.mockResolvedValueOnce(baseOrder);
    riderFindUnique.mockResolvedValueOnce({ ...activeRider, email: null });

    await assignRider(req({ riderId: RIDER_ID }), ctx);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendPush).toHaveBeenCalledTimes(1);
  });

  it("does not notify on unassign", async () => {
    orderFindUnique.mockResolvedValueOnce({ ...baseOrder, riderId: RIDER_ID });

    await assignRider(req({ riderId: null }), ctx);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("does not re-notify when re-saving the same rider", async () => {
    orderFindUnique.mockResolvedValueOnce({ ...baseOrder, riderId: RIDER_ID });
    riderFindUnique.mockResolvedValueOnce(activeRider);

    await assignRider(req({ riderId: RIDER_ID }), ctx);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("rejects assigning a rider to a pickup order, and never notifies", async () => {
    orderFindUnique.mockResolvedValueOnce({ ...baseOrder, fulfillmentType: "PICKUP" });

    const res = await assignRider(req({ riderId: RIDER_ID }), ctx);
    expect(res.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("rejects an inactive rider, and never notifies", async () => {
    orderFindUnique.mockResolvedValueOnce(baseOrder);
    riderFindUnique.mockResolvedValueOnce({ ...activeRider, isActive: false });

    const res = await assignRider(req({ riderId: RIDER_ID }), ctx);
    expect(res.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("a failed notification send never fails the assignment itself", async () => {
    orderFindUnique.mockResolvedValueOnce(baseOrder);
    riderFindUnique.mockResolvedValueOnce(activeRider);
    sendEmail.mockRejectedValueOnce(new Error("resend down"));

    const res = await assignRider(req({ riderId: RIDER_ID }), ctx);
    expect(res.status).toBe(200);
  });
});
