import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";

/**
 * Section 44 #1 — order creation idempotency, exercised against a real
 * database through the generated Prisma client. Requires `prisma
 * generate` to have been run against a reachable DATABASE_URL/DIRECT_URL
 * first (see DEPLOYMENT.md) — not run by default (`npm test` excludes
 * `*.integration.test.ts`); run explicitly with `npm run test:integration`.
 */
describe("order creation idempotency (DB-level)", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let categoryId: string;
  let productId: string;

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    const category = await prisma.category.create({ data: { name: `test-cat-${randomUUID()}` } });
    categoryId = category.id;
    const product = await prisma.product.create({
      data: { name: "Test Product", priceKobo: 1000, categoryId },
    });
    productId = product.id;
  });

  afterAll(async () => {
    await prisma.orderItem.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.$disconnect();
  });

  it("returns the same order for two requests with the same idempotencyKey (sequential double-click)", async () => {
    const idempotencyKey = randomUUID();
    const orderNumber1 = `TEST-${randomUUID()}`;
    const orderNumber2 = `TEST-${randomUUID()}`;

    const first = await prisma.order.create({
      data: {
        orderNumber: orderNumber1,
        idempotencyKey,
        fulfillmentType: "PICKUP",
        customerName: "Ada",
        customerPhone: "08012345678",
        subtotalKobo: 1000,
        totalKobo: 1000,
      },
    });

    // Simulate the route's own idempotency check: look up by key before
    // attempting a second create.
    const existing = await prisma.order.findUnique({ where: { idempotencyKey } });
    expect(existing?.id).toBe(first.id);

    // A second create with the same key must violate the unique
    // constraint rather than silently succeed — this is the backstop for
    // the true-concurrent race.
    await expect(
      prisma.order.create({
        data: {
          orderNumber: orderNumber2,
          idempotencyKey,
          fulfillmentType: "PICKUP",
          customerName: "Ada",
          customerPhone: "08012345678",
          subtotalKobo: 1000,
          totalKobo: 1000,
        },
      }),
    ).rejects.toThrow();

    const count = await prisma.order.count({ where: { idempotencyKey } });
    expect(count).toBe(1);

    await prisma.order.delete({ where: { id: first.id } });
  });

  it("two truly concurrent creates with the same key still produce exactly one row", async () => {
    const idempotencyKey = randomUUID();
    const attempt = (n: number) =>
      prisma.order.create({
        data: {
          orderNumber: `TEST-CONC-${n}-${randomUUID()}`,
          idempotencyKey,
          fulfillmentType: "PICKUP",
          customerName: "Ada",
          customerPhone: "08012345678",
          subtotalKobo: 1000,
          totalKobo: 1000,
        },
      });

    const results = await Promise.allSettled([attempt(1), attempt(2)]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(1);

    const count = await prisma.order.count({ where: { idempotencyKey } });
    expect(count).toBe(1);

    await prisma.order.deleteMany({ where: { idempotencyKey } });
  });
});
