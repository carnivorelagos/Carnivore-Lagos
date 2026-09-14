import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";

/**
 * Section 44 #3 (payment verification), #5 (webhook idempotency), #6
 * (duplicate payment protection) — all three converge on the same code
 * path, `applyPaystackOutcome`, so they're exercised together here.
 * Integration-only: needs the generated Prisma client (see
 * orderIdempotency.integration.test.ts for why this file doesn't run by
 * default).
 */
describe("applyPaystackOutcome (DB-level)", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let applyPaystackOutcome: typeof import("@/lib/payments").applyPaystackOutcome;
  let categoryId: string;
  let orderId: string;
  const reference = `test-ref-${randomUUID()}`;

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ applyPaystackOutcome } = await import("@/lib/payments"));

    const category = await prisma.category.create({ data: { name: `test-cat-${randomUUID()}` } });
    categoryId = category.id;

    const order = await prisma.order.create({
      data: {
        orderNumber: `TEST-${randomUUID()}`,
        idempotencyKey: randomUUID(),
        fulfillmentType: "PICKUP",
        customerName: "Ada",
        customerPhone: "08012345678",
        subtotalKobo: 5000,
        totalKobo: 5000,
      },
    });
    orderId = order.id;

    await prisma.payment.create({
      data: { orderId, reference, status: "PENDING", amountKobo: 5000, currency: "NGN" },
    });
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { orderId } });
    await prisma.order.delete({ where: { id: orderId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.$disconnect();
  });

  it("marks Payment SUCCESS and Order PAID on a matching successful verification (#3)", async () => {
    const result = await applyPaystackOutcome({
      outcome: "success",
      reference,
      amountKobo: 5000,
      currency: "NGN",
      customerEmail: null,
      authorization: null,
      raw: {},
    });
    expect(result).toEqual({ found: true, orderStatus: "PAID", paymentStatus: "SUCCESS", amountMismatch: false });
  });

  it("processing the same success outcome again is a no-op, not a double-charge (#5 webhook idempotency, #6 duplicate payment)", async () => {
    const before = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const result = await applyPaystackOutcome({
      outcome: "success",
      reference,
      amountKobo: 5000,
      currency: "NGN",
      customerEmail: null,
      authorization: null,
      raw: {},
    });
    const after = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

    if (!result.found) throw new Error("expected found: true");
    expect(result.paymentStatus).toBe("SUCCESS"); // reflects already-final state
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime()); // no second write happened
  });

  it("an unknown/superseded reference is a safe no-op, not an error", async () => {
    const result = await applyPaystackOutcome({
      outcome: "success",
      reference: "does-not-exist-anywhere",
      amountKobo: 5000,
      currency: "NGN",
      customerEmail: null,
      authorization: null,
      raw: {},
    });
    expect(result).toEqual({ found: false });
  });

  it("a definitive failure marks Payment FAILED and leaves Order at PENDING_PAYMENT", async () => {
    const ref2 = `test-ref-fail-${randomUUID()}`;
    const order2 = await prisma.order.create({
      data: {
        orderNumber: `TEST-${randomUUID()}`,
        idempotencyKey: randomUUID(),
        fulfillmentType: "PICKUP",
        customerName: "Ada",
        customerPhone: "08012345678",
        subtotalKobo: 2000,
        totalKobo: 2000,
      },
    });
    await prisma.payment.create({
      data: { orderId: order2.id, reference: ref2, status: "PENDING", amountKobo: 2000, currency: "NGN" },
    });

    const result = await applyPaystackOutcome({ outcome: "failed", reference: ref2, amountKobo: 2000, currency: "NGN", customerEmail: null, authorization: null, raw: {} });
    expect(result).toEqual({ found: true, orderStatus: "PENDING_PAYMENT", paymentStatus: "FAILED", amountMismatch: false });

    await prisma.payment.deleteMany({ where: { orderId: order2.id } });
    await prisma.order.delete({ where: { id: order2.id } });
  });

  it("a mismatched amount never marks the order paid, even on a 'success' status (Section 17 'full stop')", async () => {
    const ref3 = `test-ref-mismatch-${randomUUID()}`;
    const order3 = await prisma.order.create({
      data: {
        orderNumber: `TEST-${randomUUID()}`,
        idempotencyKey: randomUUID(),
        fulfillmentType: "PICKUP",
        customerName: "Ada",
        customerPhone: "08012345678",
        subtotalKobo: 9000,
        totalKobo: 9000,
      },
    });
    await prisma.payment.create({
      data: { orderId: order3.id, reference: ref3, status: "PENDING", amountKobo: 9000, currency: "NGN" },
    });

    const result = await applyPaystackOutcome({ outcome: "success", reference: ref3, amountKobo: 1, currency: "NGN", customerEmail: null, authorization: null, raw: {} });
    if (!result.found) throw new Error("expected found: true");
    expect(result.amountMismatch).toBe(true);
    expect(result.orderStatus).toBe("PENDING_PAYMENT");
    expect(result.paymentStatus).toBe("PENDING");

    await prisma.payment.deleteMany({ where: { orderId: order3.id } });
    await prisma.order.delete({ where: { id: order3.id } });
  });
});
