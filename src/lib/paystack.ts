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

/**
 * The reusable-card details Paystack attaches to a successful card charge
 * (amendment 3). `authorizationCode` is only reusable with the exact email
 * it was created against, so callers persist that email alongside it.
 */
export type PaystackAuthorization = {
  authorizationCode: string;
  last4: string | null;
  brand: string | null;
  bank: string | null;
  channel: string | null;
  reusable: boolean;
};

export type VerifyResult = {
  outcome: PaystackOutcome;
  reference: string;
  amountKobo: number;
  currency: string;
  customerEmail: string | null;
  authorization: PaystackAuthorization | null;
  raw: unknown;
};

type PaystackTxnData = {
  status?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  channel?: string;
  customer?: { email?: string };
  authorization?: {
    authorization_code?: string;
    last4?: string;
    card_type?: string;
    brand?: string;
    bank?: string;
    channel?: string;
    reusable?: boolean;
  };
};

function classifyOutcome(status: string): PaystackOutcome {
  if (status === "success") return "success";
  if (DEFINITIVE_FAILURE_STATUSES.has(status)) return "failed";
  return "pending";
}

function extractAuthorization(data: PaystackTxnData | undefined): PaystackAuthorization | null {
  const a = data?.authorization;
  if (!a?.authorization_code) return null;
  return {
    authorizationCode: a.authorization_code,
    last4: a.last4 ?? null,
    brand: a.card_type ?? a.brand ?? null,
    bank: a.bank ?? null,
    channel: a.channel ?? data?.channel ?? null,
    reusable: a.reusable === true,
  };
}

function toVerifyResult(data: PaystackTxnData | undefined, fallbackReference: string, raw: unknown): VerifyResult {
  return {
    outcome: classifyOutcome(data?.status ?? "unknown"),
    reference: data?.reference ?? fallbackReference,
    amountKobo: data?.amount ?? 0,
    currency: data?.currency ?? "NGN",
    customerEmail: data?.customer?.email ?? null,
    authorization: extractAuthorization(data),
    raw,
  };
}

export async function verifyTransaction(reference: string): Promise<VerifyResult> {
  const body = (await paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`, {
    method: "GET",
  })) as { data?: PaystackTxnData };

  return toVerifyResult(body.data, reference, body);
}

/**
 * Charge a previously-saved reusable card (amendment 3). Paystack returns
 * a final status inline for most Nigerian cards; a non-terminal status
 * falls through as `pending` and the verify/reconcile path settles it.
 * The result is fed straight into applyPaystackOutcome, exactly like a
 * verify — so a saved-card charge is server-verified the same way any
 * other payment is (amendment 5).
 */
export async function chargeAuthorization(params: {
  authorizationCode: string;
  email: string;
  amountKobo: number;
  reference: string;
}): Promise<VerifyResult> {
  const body = (await paystackFetch("/transaction/charge_authorization", {
    method: "POST",
    body: JSON.stringify({
      authorization_code: params.authorizationCode,
      email: params.email,
      amount: params.amountKobo,
      reference: params.reference,
      currency: "NGN",
    }),
  })) as { data?: PaystackTxnData };

  return toVerifyResult(body.data, params.reference, body);
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
  const body = parsed as { event?: string; data?: PaystackTxnData };
  if (!body.event || !body.data?.reference) return null;

  return {
    event: body.event,
    verify: toVerifyResult(body.data, body.data.reference, body),
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
