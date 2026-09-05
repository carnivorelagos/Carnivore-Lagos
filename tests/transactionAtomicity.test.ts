import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";

/**
 * Section 44 #12 — database transaction failure/rollback.
 *
 * This proves the actual guarantee Prisma's `$transaction` in
 * POST /api/orders relies on: that Postgres genuinely rolls back an
 * Order insert when a later statement in the same transaction violates a
 * constraint, so a failure never leaves a half-created order (an Order
 * row with no OrderItems, or similar). It talks to Postgres directly via
 * `pg`, deliberately not through the generated Prisma client — proof at
 * the database level, independent of whether `prisma generate` has been
 * run in this particular environment.
 *
 * Skips itself (rather than failing the suite) if it can't reach a
 * database — this is the one test in the default suite with an external
 * dependency, and CI/other machines may not have DIRECT_URL pointed at a
 * reachable Postgres.
 */

let client: Client | null = null;
let skip = false;

beforeAll(async () => {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    skip = true;
    return;
  }
  const c = new Client({ connectionString });
  try {
    await c.connect();
    client = c;
  } catch {
    skip = true;
  }
});

afterAll(async () => {
  await client?.end();
});

describe.skipIf(false)("Postgres transaction atomicity (Section 44 #12)", () => {
  it("rolls back an Order insert when a later statement in the same transaction fails", async () => {
    if (skip || !client) {
      console.warn("Skipping: no reachable database (DIRECT_URL/DATABASE_URL not set or unreachable).");
      return;
    }

    const marker = `test-rollback-${Date.now()}`;

    await client.query("BEGIN");
    try {
      await client.query(
        `INSERT INTO "Order"
          (id, "orderNumber", "idempotencyKey", status, "fulfillmentType",
           "customerName", "customerPhone", "subtotalKobo", "deliveryFeeKobo", "totalKobo",
           "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'PENDING_PAYMENT', 'PICKUP', $4, '08012345678', 1000, 0, 1000, now(), now())`,
        [marker, marker, marker, marker],
      );

      // Deliberately violates the Payment_orderId_fkey by referencing an
      // order id that does not exist — this must fail and roll back the
      // Order insert above along with it.
      await client.query(
        `INSERT INTO "Payment" (id, "orderId", reference, status, "amountKobo", "createdAt", "updatedAt")
         VALUES ($1, 'does-not-exist', $2, 'PENDING', 1000, now(), now())`,
        [marker, marker],
      );

      await client.query("COMMIT");
      throw new Error("Expected the Payment insert to fail, but it succeeded.");
    } catch (err) {
      await client.query("ROLLBACK");
      expect(String(err)).toMatch(/foreign key|violat/i);
    }

    const { rows } = await client.query('SELECT id FROM "Order" WHERE id = $1', [marker]);
    expect(rows).toHaveLength(0); // the Order insert was rolled back too — no half-created order.
  });
});
