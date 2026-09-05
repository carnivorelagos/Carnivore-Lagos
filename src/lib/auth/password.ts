import bcrypt from "bcryptjs";

/**
 * bcrypt, not argon2 (Section 21/22 reasoning): argon2's native bindings
 * are a recurring source of serverless bundling failures, and bcrypt is
 * more than adequate for an admin-only login surface at this scale.
 * `bcryptjs` is pure JS — no native binary to bundle for Netlify Functions
 * at all.
 */
const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
