import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError, ErrorCode } from "./errors";

/**
 * Thin wrapper around Paystack's REST API, matching current InlineJS v2 +
 * Transactions docs (checked live at implementation time, per Section 14 —
 * not from memory): server calls Initialize Transaction to get an
 * access_code, the frontend opens the popup pre-loaded with
 * `popup.resumeTransaction(access_code)`, and the server is the only
 * thing that ever trusts a "success" (via Verify Transaction + the
 * webhook) — never the frontend's onSuccess callback alone (Section 17).
 */

const PAYSTACK_BASE = "https://api.paystack.co";

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set.");
  return key;
}

async function paystackFetch(path: string, init: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${PAYSTACK_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  } catch {
    throw new AppError(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE, "Could not reach the payment provider. Please try again.");
  }

  if (!res.ok && res.status >= 500) {
    throw new AppError(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE, "The payment provider is temporarily unavailable. Please try again.");
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new AppError(
      ErrorCode.PAYMENT_VERIFICATION_FAILED,
      (body as { message?: string } | null)?.message ?? "The payment provider rejected this request.",
    );
  }
  return body;
}

export type InitializeResult = {
  reference: string;
  accessCode: string;
  authorizationUrl: string;
};

export async function initializeTransaction(params: {
  email: string;
  amountKobo: number;
  reference: string;
}): Promise<InitializeResult> {
  const body = (await paystackFetch("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo, // Paystack amounts are integer minor units too.
      reference: params.reference,
      currency: "NGN",
    }),
  })) as { data?: { access_code?: string; reference?: string; authorization_url?: string } };

  if (!body.data?.access_code || !body.data?.reference) {
    throw new AppError(ErrorCode.PAYMENT_PROVIDER_UNAVAILABLE, "The payment provider returned an unexpected response.");
  }

  return {
    reference: body.data.reference,
    accessCode: body.data.access_code,
    authorizationUrl: body.data.authorization_url ?? "",
  };
}

/**
 * Paystack's transaction statuses collapse into exactly three buckets for
 * our purposes — this is the classification the three-way verify/webhook
 * branch (Section 17/45) is built around.
 */
export type PaystackOutcome = "success" | "failed" | "pending";

const DEFINITIVE_FAILURE_STATUSES = new Set(["failed", "abandoned", "reversed"]);

export type VerifyResult = {
  outcome: PaystackOutcome;
  reference: string;
  amountKobo: number;
  currency: string;
  raw: unknown;
};

function classifyOutcome(status: string): PaystackOutcome {
  if (status === "success") return "success";
  if (DEFINITIVE_FAILURE_STATUSES.has(status)) return "failed";
  return "pending";
}

export async function verifyTransaction(reference: string): Promise<VerifyResult> {
  const body = (await paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`, {
    method: "GET",
  })) as { data?: { status?: string; reference?: string; amount?: number; currency?: string } };

  return {
    outcome: classifyOutcome(body.data?.status ?? "unknown"),
    reference: body.data?.reference ?? reference,
    amountKobo: body.data?.amount ?? 0,
    currency: body.data?.currency ?? "NGN",
    raw: body,
  };
}

/**
 * Turns a signature-verified webhook payload directly into a VerifyResult,
 * so the webhook handler can reuse applyPaystackOutcome without an extra
 * round trip back to Paystack's Verify Transaction endpoint (Section 40 —
 * avoid repeated Paystack calls). Safe specifically because the caller
 * has already checked verifyWebhookSignature on this same raw body; the
 * signature is what authenticates the payload, not this parsing step.
 */
export function parseWebhookEvent(rawBody: string): { event: string; verify: VerifyResult } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }
  const body = parsed as { event?: string; data?: { status?: string; reference?: string; amount?: number; currency?: string } };
  if (!body.event || !body.data?.reference) return null;

  return {
    event: body.event,
    verify: {
      outcome: classifyOutcome(body.data.status ?? "unknown"),
      reference: body.data.reference,
      amountKobo: body.data.amount ?? 0,
      currency: body.data.currency ?? "NGN",
      raw: body,
    },
  };
}

/**
 * Webhook signature verification (Section 18): HMAC-SHA512 of the raw
 * request body using the secret key, compared against the
 * `x-paystack-signature` header. Must run against the *raw* body string —
 * never a re-serialized parsed object, which can produce a different byte
 * sequence and a false signature mismatch.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac("sha512", secretKey()).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(signatureHeader, "utf8");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
