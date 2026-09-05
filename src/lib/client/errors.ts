import { ApiError, isApiError } from "./api";

/**
 * Central mapping of backend error codes -> customer-facing copy
 * (Section 39). Raw backend messages are never shown where a friendly
 * string is defined here. `kind` tells the caller how to surface it.
 */
export type ErrorKind = "field" | "inline" | "toast" | "redirect" | "silent";

type ErrorCopy = { title: string; message: string; kind: ErrorKind };

export const ERROR_COPY: Record<string, ErrorCopy> = {
  VALIDATION_ERROR: {
    title: "Check the form",
    message: "Some details need a second look.",
    kind: "field",
  },
  NOT_FOUND: {
    title: "Not found",
    message: "We couldn't find what you were looking for.",
    kind: "inline",
  },
  PRODUCT_UNAVAILABLE: {
    title: "Some items are unavailable",
    message: "Some items in your cart are no longer available. Update your cart to continue.",
    kind: "inline",
  },
  DELIVERY_OUT_OF_RANGE: {
    title: "Outside delivery range",
    message: "That address is outside our delivery range. Try pickup or a closer address.",
    kind: "inline",
  },
  FULFILLMENT_TYPE_UNAVAILABLE: {
    title: "Not available right now",
    message: "That option isn't available right now. Please choose another.",
    kind: "inline",
  },
  ORDER_ALREADY_PAID: {
    title: "Already paid",
    message: "This order has already been paid for.",
    kind: "redirect",
  },
  ORDER_NOT_PAYABLE: {
    title: "Can't be paid",
    message: "This order can no longer be paid for.",
    kind: "inline",
  },
  INVALID_TRANSITION: {
    title: "Not allowed",
    message: "That status change isn't allowed for this order.",
    kind: "toast",
  },
  PAYMENT_PROVIDER_UNAVAILABLE: {
    title: "Payment unavailable",
    message: "Payment is temporarily unavailable. Please try again shortly.",
    kind: "inline",
  },
  PAYMENT_VERIFICATION_FAILED: {
    title: "Payment not confirmed",
    message: "We couldn't confirm that payment. Please try again.",
    kind: "inline",
  },
  UNAUTHORIZED: {
    title: "Sign in required",
    message: "Please sign in to continue.",
    kind: "redirect",
  },
  FORBIDDEN: {
    title: "Something went wrong",
    message: "We couldn't complete that request. Please try again.",
    kind: "toast",
  },
  ACCOUNT_LOCKED: {
    title: "Account locked",
    message: "This account is temporarily locked after too many attempts. Try again later.",
    kind: "inline",
  },
  INVALID_CREDENTIALS: {
    title: "Incorrect details",
    message: "Incorrect email or password.",
    kind: "inline",
  },
  RATE_LIMITED: {
    title: "Slow down a moment",
    message: "Too many attempts. Please wait a moment and try again.",
    kind: "inline",
  },
  CONFLICT: {
    title: "Just updated elsewhere",
    message: "This was just updated elsewhere. Refreshing to the current state.",
    kind: "toast",
  },
  OTP_INVALID: {
    title: "Wrong code",
    message: "That code isn't right. Try again.",
    kind: "field",
  },
  OTP_EXPIRED: {
    title: "Code expired",
    message: "That code expired. Request a new one.",
    kind: "field",
  },
  EMAIL_NOT_VERIFIED: {
    title: "Verify your email",
    message: "Verify your email address before paying online.",
    kind: "inline",
  },
  INTERNAL_ERROR: {
    title: "Something went wrong",
    message: "Something went wrong on our end. Please try again.",
    kind: "toast",
  },
  NETWORK: {
    title: "Connection problem",
    message: "Couldn't reach the server. Check your connection and try again.",
    kind: "inline",
  },
};

const FALLBACK: ErrorCopy = {
  title: "Something went wrong",
  message: "Something went wrong. Please try again.",
  kind: "toast",
};

export function errorCopy(e: unknown): ErrorCopy {
  if (isApiError(e)) return ERROR_COPY[e.code] ?? { ...FALLBACK, message: e.message || FALLBACK.message };
  return FALLBACK;
}

export function errorMessage(e: unknown): string {
  return errorCopy(e).message;
}

export function errorCode(e: unknown): string | null {
  return e instanceof ApiError ? e.code : null;
}

/** Field-level messages from a VALIDATION_ERROR details array. */
export function fieldErrors(e: unknown): Record<string, string> {
  if (!isApiError(e) || e.code !== "VALIDATION_ERROR") return {};
  const details = e.details;
  if (!Array.isArray(details)) return {};
  const out: Record<string, string> = {};
  for (const d of details as { path?: string; message?: string }[]) {
    if (d?.path && d?.message && !(d.path in out)) out[d.path] = d.message;
  }
  return out;
}
