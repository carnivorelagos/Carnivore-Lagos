/**
 * Every error the API can return to a client is one of these codes.
 * Route handlers throw AppError; the shared handler (api-response.ts)
 * catches it and renders the Section 34 error shape with the right HTTP
 * status. Anything that isn't an AppError (a raw Prisma/DB error, a bug)
 * is logged in full server-side and rendered to the client as a generic
 * INTERNAL_ERROR — no stack traces, no SQL, no Prisma error text ever
 * reaches a response body.
 */
export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  PRODUCT_UNAVAILABLE: "PRODUCT_UNAVAILABLE",
  DELIVERY_OUT_OF_RANGE: "DELIVERY_OUT_OF_RANGE",
  FULFILLMENT_TYPE_UNAVAILABLE: "FULFILLMENT_TYPE_UNAVAILABLE",
  ORDER_ALREADY_PAID: "ORDER_ALREADY_PAID",
  ORDER_NOT_PAYABLE: "ORDER_NOT_PAYABLE",
  INVALID_TRANSITION: "INVALID_TRANSITION",
  PAYMENT_PROVIDER_UNAVAILABLE: "PAYMENT_PROVIDER_UNAVAILABLE",
  PAYMENT_VERIFICATION_FAILED: "PAYMENT_VERIFICATION_FAILED",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  RATE_LIMITED: "RATE_LIMITED",
  CONFLICT: "CONFLICT",
  OTP_INVALID: "OTP_INVALID",
  OTP_EXPIRED: "OTP_EXPIRED",
  EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCodeName = (typeof ErrorCode)[keyof typeof ErrorCode];

const STATUS_BY_CODE: Record<ErrorCodeName, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  PRODUCT_UNAVAILABLE: 409,
  DELIVERY_OUT_OF_RANGE: 422,
  FULFILLMENT_TYPE_UNAVAILABLE: 422,
  ORDER_ALREADY_PAID: 409,
  ORDER_NOT_PAYABLE: 409,
  INVALID_TRANSITION: 409,
  PAYMENT_PROVIDER_UNAVAILABLE: 503,
  PAYMENT_VERIFICATION_FAILED: 402,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  ACCOUNT_LOCKED: 423,
  INVALID_CREDENTIALS: 401,
  RATE_LIMITED: 429,
  CONFLICT: 409,
  OTP_INVALID: 400,
  OTP_EXPIRED: 400,
  EMAIL_NOT_VERIFIED: 403,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ErrorCodeName;
  readonly status: number;
  /** Extra machine-readable context (e.g. which product IDs were unavailable). Never includes secrets. */
  readonly details?: unknown;

  constructor(code: ErrorCodeName, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

export function notFound(entity: string): AppError {
  return new AppError(ErrorCode.NOT_FOUND, `${entity} not found.`);
}

export function validationError(message: string, details?: unknown): AppError {
  return new AppError(ErrorCode.VALIDATION_ERROR, message, details);
}
