import { NextRequest } from "next/server";
import { AppError, ErrorCode } from "../errors";

/**
 * Shared by requireAdmin and requireCustomer — extracted so the two auth
 * paths can never quietly drift apart on this check. `SameSite=Lax`
 * already blocks cross-site form posts from carrying the cookie; this
 * additionally checks the request's Origin header against the app's own
 * origin, since Route Handlers don't get CSRF protection for free the
 * way a server-rendered form framework does.
 */
export function assertSameOrigin(req: NextRequest): void {
  const origin = req.headers.get("origin");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!origin || !appUrl) {
    // In practice both are always present for a browser-originated
    // state-changing request; missing either is treated as suspicious.
    throw new AppError(ErrorCode.FORBIDDEN, "Request origin could not be verified.");
  }
  if (new URL(origin).origin !== new URL(appUrl).origin) {
    throw new AppError(ErrorCode.FORBIDDEN, "Cross-origin request rejected.");
  }
}
