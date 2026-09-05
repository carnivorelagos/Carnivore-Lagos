import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.AUTH_SECRET = "unit-test-secret-at-least-16-chars";
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
});

describe("password hashing — Section 44 #7 admin authentication", () => {
  it("hashes never equal the plaintext and verify correctly round-trips", async () => {
    const { hashPassword, verifyPassword } = await import("@/lib/auth/password");
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toBe("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  it("two hashes of the same password are different (salted)", async () => {
    const { hashPassword } = await import("@/lib/auth/password");
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
  });
});

describe("session tokens — Section 44 #8 admin authorization", () => {
  it("signs and verifies a session round-trip", async () => {
    const { signSession, verifySessionToken } = await import("@/lib/auth/session");
    const token = await signSession({ adminId: "admin-1", email: "a@example.com", role: "ADMIN" });
    const payload = await verifySessionToken(token);
    expect(payload).toEqual({ adminId: "admin-1", email: "a@example.com", role: "ADMIN" });
  });

  it("rejects a tampered token", async () => {
    const { signSession, verifySessionToken } = await import("@/lib/auth/session");
    const token = await signSession({ adminId: "admin-1", email: "a@example.com", role: "ADMIN" });
    const tampered = token.slice(0, -3) + "xyz";
    expect(await verifySessionToken(tampered)).toBeNull();
  });

  it("rejects garbage input instead of throwing", async () => {
    const { verifySessionToken } = await import("@/lib/auth/session");
    expect(await verifySessionToken("not-a-jwt")).toBeNull();
  });
});
