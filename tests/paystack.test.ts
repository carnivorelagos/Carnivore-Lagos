import { describe, it, expect, beforeAll } from "vitest";
import { createHmac } from "node:crypto";

beforeAll(() => {
  process.env.PAYSTACK_SECRET_KEY = "sk_test_unit_test_secret";
});

describe("Paystack webhook — Section 44 #4 signature verification", () => {
  it("accepts a correctly signed payload", async () => {
    const { verifyWebhookSignature } = await import("@/lib/paystack");
    const body = JSON.stringify({ event: "charge.success", data: { reference: "abc123", status: "success", amount: 100000, currency: "NGN" } });
    const signature = createHmac("sha512", "sk_test_unit_test_secret").update(body).digest("hex");
    expect(verifyWebhookSignature(body, signature)).toBe(true);
  });

  it("rejects a tampered body even if the signature was valid for the original body", async () => {
    const { verifyWebhookSignature } = await import("@/lib/paystack");
    const original = JSON.stringify({ event: "charge.success", data: { reference: "abc123", amount: 100000 } });
    const signature = createHmac("sha512", "sk_test_unit_test_secret").update(original).digest("hex");
    const tampered = JSON.stringify({ event: "charge.success", data: { reference: "abc123", amount: 1 } });
    expect(verifyWebhookSignature(tampered, signature)).toBe(false);
  });

  it("rejects a missing signature header", async () => {
    const { verifyWebhookSignature } = await import("@/lib/paystack");
    expect(verifyWebhookSignature("{}", null)).toBe(false);
  });

  it("rejects a signature computed with the wrong secret", async () => {
    const { verifyWebhookSignature } = await import("@/lib/paystack");
    const body = JSON.stringify({ event: "charge.success" });
    const wrongSignature = createHmac("sha512", "not-the-real-secret").update(body).digest("hex");
    expect(verifyWebhookSignature(body, wrongSignature)).toBe(false);
  });
});

describe("parseWebhookEvent — three-way status classification", () => {
  it("classifies a success status", async () => {
    const { parseWebhookEvent } = await import("@/lib/paystack");
    const parsed = parseWebhookEvent(
      JSON.stringify({ event: "charge.success", data: { status: "success", reference: "r1", amount: 5000, currency: "NGN" } }),
    );
    expect(parsed?.verify.outcome).toBe("success");
  });

  it("classifies failed/declined/abandoned as a definitive failure", async () => {
    const { parseWebhookEvent } = await import("@/lib/paystack");
    for (const status of ["failed", "abandoned", "reversed"]) {
      const parsed = parseWebhookEvent(
        JSON.stringify({ event: "charge.failed", data: { status, reference: "r1", amount: 5000, currency: "NGN" } }),
      );
      expect(parsed?.verify.outcome).toBe("failed");
    }
  });

  it("classifies anything else as still pending — no write should happen for these", async () => {
    const { parseWebhookEvent } = await import("@/lib/paystack");
    const parsed = parseWebhookEvent(
      JSON.stringify({ event: "charge.pending", data: { status: "ongoing", reference: "r1" } }),
    );
    expect(parsed?.verify.outcome).toBe("pending");
  });

  it("returns null for an unparseable or shapeless payload rather than throwing", async () => {
    const { parseWebhookEvent } = await import("@/lib/paystack");
    expect(parseWebhookEvent("not json")).toBeNull();
    expect(parseWebhookEvent(JSON.stringify({ hello: "world" }))).toBeNull();
  });
});
