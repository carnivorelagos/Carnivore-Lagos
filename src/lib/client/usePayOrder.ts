"use client";

import { useCallback, useState } from "react";
import { chargeSavedCard, initializePayment, verifyPayment } from "./endpoints";
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
 * Resume payment for an already-created order (order tracking page).
 * Two paths:
 *  - `savedCardSlug` set → charge the device's stored card server-side
 *    (amendment 3), no popup.
 *  - otherwise → initialize server-side, Paystack popup, server verify.
 * Either way the server is authoritative (amendment 5).
 */
export function usePayOrder() {
  const [paying, setPaying] = useState(false);

  const pay = useCallback(
    async (orderId: string, opts?: { savedCardSlug?: string }): Promise<PayOutcome> => {
      setPaying(true);
      try {
        if (opts?.savedCardSlug) {
          try {
            const res = await chargeSavedCard(opts.savedCardSlug);
            if (res.amountMismatch) return { kind: "mismatch", reference: "" };
            if (res.paymentStatus === "SUCCESS" || res.orderStatus === "PAID")
              return { kind: "paid", reference: "" };
            return { kind: "pending", reference: "" };
          } catch (e) {
            const code = errorCode(e);
            if (code === "ORDER_ALREADY_PAID") return { kind: "already-paid" };
            return { kind: "error", message: errorMessage(e), code };
          }
        }

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
    },
    [],
  );

  return { pay, paying };
}
