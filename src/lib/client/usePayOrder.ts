"use client";

import { useCallback, useState } from "react";
import { initializePayment, verifyPayment } from "./endpoints";
import { runPaystackCheckout } from "./paystack";
import { errorCode, errorMessage } from "./errors";

export type PayOutcome =
  | { kind: "paid"; reference: string }
  | { kind: "pending"; reference: string }
  | { kind: "already-paid" }
  | { kind: "cancelled" }
  | { kind: "mismatch"; reference: string }
  | { kind: "error"; message: string; code: string | null };

/**
 * Resume payment for an already-created order (order tracking page,
 * account order detail). Mirrors the checkout flow: initialize server-side
 * -> Paystack popup -> server verify (authoritative).
 */
export function usePayOrder() {
  const [paying, setPaying] = useState(false);

  const pay = useCallback(async (orderId: string): Promise<PayOutcome> => {
    setPaying(true);
    try {
      let accessCode: string;
      try {
        const init = await initializePayment(orderId);
        accessCode = init.accessCode;
      } catch (e) {
        const code = errorCode(e);
        if (code === "ORDER_ALREADY_PAID") return { kind: "already-paid" };
        return { kind: "error", message: errorMessage(e), code };
      }

      const result = await runPaystackCheckout(accessCode);
      if (result.outcome === "cancelled") return { kind: "cancelled" };
      if (result.outcome === "error")
        return { kind: "error", message: result.message, code: "PAYSTACK" };

      try {
        const verified = await verifyPayment(result.reference);
        if (verified.amountMismatch) return { kind: "mismatch", reference: result.reference };
        if (verified.paymentStatus === "SUCCESS" || verified.orderStatus === "PAID")
          return { kind: "paid", reference: result.reference };
        return { kind: "pending", reference: result.reference };
      } catch {
        // Webhook will reconcile; treat as pending.
        return { kind: "pending", reference: result.reference };
      }
    } finally {
      setPaying(false);
    }
  }, []);

  return { pay, paying };
}
