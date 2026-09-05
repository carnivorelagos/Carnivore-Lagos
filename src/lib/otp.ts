import { randomInt, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Pure OTP primitives — generation, hashing, comparison. No DB access
 * here on purpose (same split as password.ts vs loginAttempt.ts): this
 * module is unit-testable with zero external dependencies, and the
 * DB-touching orchestration (create a row, check attempts/expiry,
 * consume it) lives in src/lib/auth/phoneAuth.ts and emailVerification.ts.
 *
 * HMAC-SHA256 with AUTH_SECRET as the key, not bcrypt (deliberate
 * difference from password.ts): a 6-digit code is short-lived (5 minutes)
 * and rate/attempt-limited rather than a long-lived credential, so
 * bcrypt's deliberate slowness buys nothing here — HMAC is fast, and
 * still means a read-only DB leak alone can't recover a valid code
 * without also having AUTH_SECRET.
 */

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60_000; // 5 minutes
export const OTP_MAX_ATTEMPTS = 5;

/** Cryptographically random 6-digit code, zero-padded (e.g. "004821"). */
export function generateOtpCode(): string {
  return randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");
}

function getPepper(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET is not set or is shorter than 32 characters — refusing to hash/verify OTP codes. Generate one with `openssl rand -base64 32`.",
    );
  }
  return Buffer.from(secret);
}

export function hashOtpCode(code: string): string {
  return createHmac("sha256", getPepper()).update(code).digest("hex");
}

/** Constant-time comparison — never a plain `===` on secret-derived hashes. */
export function verifyOtpCode(code: string, codeHash: string): boolean {
  const expected = Buffer.from(hashOtpCode(code), "hex");
  const actual = Buffer.from(codeHash, "hex");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
