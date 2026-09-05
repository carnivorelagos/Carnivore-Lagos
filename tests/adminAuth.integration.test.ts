import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";

/**
 * Section 44 #7 (admin authentication) — the per-account lockout, tested
 * against the real DB through the exact function the login route calls.
 * Integration-only; see orderIdempotency.integration.test.ts.
 */
describe("attemptAdminLogin (DB-level lockout)", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let attemptAdminLogin: typeof import("@/lib/auth/loginAttempt").attemptAdminLogin;
  const email = `test-admin-${randomUUID()}@example.com`;
  const correctPassword = "correct-horse-battery-staple";

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    ({ attemptAdminLogin } = await import("@/lib/auth/loginAttempt"));
    const { hashPassword } = await import("@/lib/auth/password");

    await prisma.adminUser.create({
      data: { email, passwordHash: await hashPassword(correctPassword), role: "ADMIN" },
    });
  });

  afterAll(async () => {
    await prisma.adminUser.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it("succeeds with the correct password and resets any failure count", async () => {
    const result = await attemptAdminLogin(email, correctPassword);
    expect(result.email).toBe(email);
    const row = await prisma.adminUser.findUniqueOrThrow({ where: { email } });
    expect(row.failedLoginCount).toBe(0);
    expect(row.lastLoginAt).not.toBeNull();
  });

  it("rejects a wrong password without revealing which part was wrong, and increments the counter", async () => {
    await expect(attemptAdminLogin(email, "wrong-password")).rejects.toThrow();
    const row = await prisma.adminUser.findUniqueOrThrow({ where: { email } });
    expect(row.failedLoginCount).toBe(1);
  });

  it("locks the account after 5 consecutive failures, and a correct password is then still rejected", async () => {
    for (let i = 0; i < 5; i++) {
      await expect(attemptAdminLogin(email, "wrong-password")).rejects.toThrow();
    }
    const row = await prisma.adminUser.findUniqueOrThrow({ where: { email } });
    expect(row.lockedUntil).not.toBeNull();
    expect(row.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

    // Even the RIGHT password is rejected while locked.
    await expect(attemptAdminLogin(email, correctPassword)).rejects.toThrow(/too many failed attempts/i);
  });

  it("rejects a login for an unknown email with the same generic error as a wrong password", async () => {
    await expect(attemptAdminLogin("no-such-admin@example.com", "anything")).rejects.toThrow(
      /incorrect email or password/i,
    );
  });
});
