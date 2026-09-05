import { NextRequest } from "next/server";
import { AppError, ErrorCode } from "../errors";
import { SESSION_COOKIE_NAME, SessionPayload, verifySessionToken } from "./session";
import { assertSameOrigin } from "./csrf";

const ROLE_RANK: Record<SessionPayload["role"], number> = {
  ADMIN: 1,
  SUPER_ADMIN: 2,
};

/**
 * Single entry point every admin route calls (Section 24) — a future role
 * or a route that needs to be SUPER_ADMIN-only is a one-line change here,
 * not a scattered set of `if (user.isAdmin)` checks throughout the codebase.
 *
 * Also the CSRF second layer for state-changing requests (Section 27):
 * `SameSite=Lax` already blocks cross-site form posts from carrying the
 * cookie; this additionally checks the request's Origin header against
 * the app's own origin, since Route Handlers don't get CSRF protection
 * for free the way a server-rendered form framework does.
 */
export async function requireAdmin(
  req: NextRequest,
  minRole: SessionPayload["role"] = "ADMIN",
): Promise<SessionPayload> {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Sign in required.");
  }

  const session = await verifySessionToken(token);
  if (!session) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Session is invalid or expired.");
  }

  if (ROLE_RANK[session.role] < ROLE_RANK[minRole]) {
    throw new AppError(ErrorCode.FORBIDDEN, "You do not have permission to do this.");
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    assertSameOrigin(req);
  }

  return session;
}
