import type { PaystackTransaction } from "@paystack/inline-js";

/**
 * Paystack Inline v2. The backend has already called Initialize
 * Transaction server-side (POST /api/payments/initialize) and handed us
 * an `accessCode` that fully carries the transaction - so no public key
 * is needed here. We open the popup with `resumeTransaction(accessCode)`.
 *
 * The popup's onSuccess is NOT proof of payment (Section 23). The caller
 * must still hit GET /api/payments/verify?reference=... afterwards; that
 * server response is authoritative.
 */
export type PaystackResult =
  | { outcome: "success"; reference: string }
  | { outcome: "cancelled" }
  | { outcome: "error"; message: string };

let popPromise: Promise<typeof import("@paystack/inline-js").default> | null = null;

async function loadPaystackPop() {
  if (!popPromise) {
    popPromise = import("@paystack/inline-js").then((m) => m.default);
  }
  return popPromise;
}

export async function runPaystackCheckout(accessCode: string): Promise<PaystackResult> {
  let PaystackPop: typeof import("@paystack/inline-js").default;
  try {
    PaystackPop = await loadPaystackPop();
  } catch {
    return { outcome: "error", message: "Payment couldn't start. Check your connection and try again." };
  }

  return new Promise<PaystackResult>((resolve) => {
    let settled = false;
    const done = (r: PaystackResult) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };

    try {
      const popup = new PaystackPop();
      popup.resumeTransaction(accessCode, {
        onSuccess: (tx: PaystackTransaction) =>
          done({ outcome: "success", reference: tx?.reference ?? "" }),
        onCancel: () => done({ outcome: "cancelled" }),
        onError: (err: { message?: string }) =>
          done({
            outcome: "error",
            message: err?.message || "Payment could not be completed.",
          }),
      });
    } catch (e) {
      done({
        outcome: "error",
        message: e instanceof Error ? e.message : "Payment could not be started.",
      });
    }
  });
}
