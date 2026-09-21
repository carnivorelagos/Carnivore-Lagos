import { NextRequest, NextResponse } from "next/server";
import {
  GOOGLE_OAUTH_COOKIE,
  GOOGLE_OAUTH_TTL_SECONDS,
  buildAuthorizeUrl,
  googleRedirectUri,
  isGoogleConfigured,
  newOAuthState,
  safeNextPath,
} from "@/lib/auth/google";
import { enforceRateLimit, clientIp } from "@/lib/rateLimit";

/**
 * Browser navigation (a plain link), not a JSON API: sends the customer to
 * Google's account chooser. state + nonce + PKCE verifier are kept in a
 * short-lived httpOnly cookie and checked again in the callback.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const origin = req.nextUrl.origin;
  const next = safeNextPath(req.nextUrl.searchParams.get("next"));

  if (!isGoogleConfigured()) {
    return NextResponse.redirect(new URL(`${next}${next.includes("?") ? "&" : "?"}signin=unavailable`, origin));
  }

  try {
    await enforceRateLimit({ key: `google_start_ip:${clientIp(req)}`, max: 30 });
  } catch {
    return NextResponse.redirect(new URL(`${next}${next.includes("?") ? "&" : "?"}signin=failed`, origin));
  }

  const oauth = newOAuthState(next);
  const res = NextResponse.redirect(buildAuthorizeUrl(oauth, googleRedirectUri(origin)));
  res.cookies.set(GOOGLE_OAUTH_COOKIE, JSON.stringify(oauth), {
    httpOnly: true,
    secure: true,
    sameSite: "lax", // must ride along on Google's top-level redirect back
    path: "/api/auth/google",
    maxAge: GOOGLE_OAUTH_TTL_SECONDS,
  });
  return res;
}
