import { randomInt } from "node:crypto";

// Unambiguous charset — no 0/O or 1/I/L confusion when read aloud at a
// pickup counter or typed from a receipt.
const CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const SUFFIX_LENGTH = 6;

function randomSuffix(): string {
  let out = "";
  for (let i = 0; i < SUFFIX_LENGTH; i++) {
    out += CHARSET[randomInt(CHARSET.length)];
  }
  return out;
}

/**
 * Customer-facing order reference — never the raw DB id (Section 37).
 * Format: ORD-YYYYMMDD-XXXXXX. Uniqueness is enforced by the DB's
 * `@unique` constraint on Order.orderNumber; on the (very unlikely)
 * collision, the caller should catch the constraint violation and retry
 * with a freshly generated number rather than treating it as a hard
 * failure.
 */
export function generateOrderNumber(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `ORD-${y}${m}${d}-${randomSuffix()}`;
}
