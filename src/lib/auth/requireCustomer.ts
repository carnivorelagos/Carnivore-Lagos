import { NextRequest } from "next/server";
import { AppError, ErrorCode } from "../errors";
import {
  CUSTOMER_SESSION_COOKIE_NAME,
  CustomerSessionPayload,
  verifyCustomerSessionToken,
} from "./customerSession";
import { assertSameOrigin } from "./csrf";

/**
 * Single entry point every customer-authenticated route calls — same
 * pattern as requireAdmin, no role concept here since there's only one
 * kind of customer. Checking out (POST /api/orders) requires this;
 * browsing the menu deliberately does not (Section: accounts-only
 * checkout, browsing stays public).
 */
export async function requireCustomer(req: NextRequest): Promise<CustomerSessionPayload> {
  const token = req.cookies.get(CUSTOMER_SESSION_COOKIE_NAME)?.value;
  if (!token) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Sign in required.");
  }

  const session = await verifyCustomerSessionToken(token);
  if (!session) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Session is invalid or expired.");
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    assertSameOrigin(req);
  }

  return session;
}
