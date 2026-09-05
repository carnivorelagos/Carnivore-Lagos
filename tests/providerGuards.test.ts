import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * The single most important property of sms.ts / email.ts: a live site
 * with SMS_PROVIDER / EMAIL_PROVIDER unset must fail loudly the first
 * time it tries to send, not silently print OTP codes and receipts into
 * function logs forever. Each test re-imports the module fresh (vitest's
 * module registry reset) since both modules cache their resolved
 * provider in a module-level variable.
 *
 * Uses vi.stubEnv/vi.unstubAllEnvs rather than assigning process.env.*
 * directly — this Next.js version's ambient types declare NODE_ENV
 * readonly (see node_modules/next/types/global.d.ts), so a direct
 * assignment doesn't type-check even though it works at runtime.
 */
describe("sms provider production guard", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refuses to send via the console fallback when NODE_ENV=production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { getSmsProvider } = await import("@/lib/sms");
    await expect(getSmsProvider().send({ to: "+2348012345678", body: "test" })).rejects.toThrow(
      /No real SMS provider is configured/,
    );
  });

  it("sends fine via the console fallback outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const { getSmsProvider } = await import("@/lib/sms");
    await expect(getSmsProvider().send({ to: "+2348012345678", body: "test" })).resolves.toBeUndefined();
  });
});

describe("email provider production guard", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refuses to send via the console fallback when NODE_ENV=production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { getEmailProvider } = await import("@/lib/email");
    await expect(
      getEmailProvider().send({ to: "a@example.com", subject: "s", html: "<p>x</p>", text: "x" }),
    ).rejects.toThrow(/No real email provider is configured/);
  });

  it("sends fine via the console fallback outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const { getEmailProvider } = await import("@/lib/email");
    await expect(
      getEmailProvider().send({ to: "a@example.com", subject: "s", html: "<p>x</p>", text: "x" }),
    ).resolves.toBeUndefined();
  });
});
