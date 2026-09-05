import { describe, it, expect, beforeAll } from "vitest";
import { generateOtpCode, hashOtpCode, verifyOtpCode, OTP_LENGTH } from "@/lib/otp";

describe("generateOtpCode", () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = "test-only-secret-at-least-16-chars";
  });

  it("produces a zero-padded 6-digit numeric string", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateOtpCode();
      expect(code).toMatch(/^\d{6}$/);
      expect(code.length).toBe(OTP_LENGTH);
    }
  });

  it("200 draws are not all identical (sanity check on randomness)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(generateOtpCode());
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("hashOtpCode / verifyOtpCode", () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = "test-only-secret-at-least-16-chars";
  });

  it("verifies a code against its own hash", () => {
    const code = "042817";
    const hash = hashOtpCode(code);
    expect(verifyOtpCode(code, hash)).toBe(true);
  });

  it("rejects a wrong code against another code's hash", () => {
    const hash = hashOtpCode("042817");
    expect(verifyOtpCode("042818", hash)).toBe(false);
  });

  it("hashing is deterministic for the same code and secret", () => {
    expect(hashOtpCode("123456")).toBe(hashOtpCode("123456"));
  });

  it("never throws on a malformed/mismatched-length hash (constant-time compare guard)", () => {
    expect(() => verifyOtpCode("123456", "not-a-real-hash")).not.toThrow();
    expect(verifyOtpCode("123456", "not-a-real-hash")).toBe(false);
  });

  it("refuses to hash when AUTH_SECRET is missing or too short", () => {
    const original = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "short";
    expect(() => hashOtpCode("123456")).toThrow(/AUTH_SECRET/);
    process.env.AUTH_SECRET = original;
  });
});
