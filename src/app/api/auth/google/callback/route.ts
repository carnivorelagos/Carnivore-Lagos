import { NextRequest, NextResponse } from "next/server";
import { GOOGLE_OAUTH_COOKIE, exchangeCodeForIdentity, googleRedirectUri, isGoogleConfigured, safeNextPath, type OAuthState } from "@/lib/auth/google";
import { getOrCreateDeviceProfile, attachDeviceTokenCookie } from "@/lib/auth/deviceProfile";
import { linkDeviceToVerifiedEmail } from "@/lib/auth/contactVerification";
import { enforceRateLimit, clientIp } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";

function parseState(raw: string | undefined): OAuthState | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<OAuthState>;
    if (
      typeof v.state === "string" &&
      typeof v.nonce === "string" &&
      typeof v.verifier === "string" &&
      typeof v.next === "string"
    ) {
      return { state: v.state, nonce: v.nonce, verifier: v.verifier, next: safeNextPath(v.next) };
    }
  } catch {
    /* fall through */
  }
  return null;
}

/**
 * Google's redirect target. Verifies state, exchanges the code, checks the
 * ID token, then does what the magic-link confirm does: link THIS device to
 * the verified email (merging any history already held under that email) and
 * carry on to the page the customer started from. Always ends in a redirect.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const origin = req.nextUrl.origin;
  const oauth = parseState(req.cookies.get(GOOGLE_OAUTH_COOKIE)?.value);
  const back = (path: string, flag: string) =>
    NextResponse.redirect(new URL(`${path}${path.includes("?") ? "&" : "?"}${flag}`, origin));
  const clearing = (res: NextResponse) => {
    res.cookies.set(GOOGLE_OAUTH_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/api/auth/google", maxAge: 0 });
    return res;
  };

  if (!isGoogleConfigured() || !oauth) return clearing(back("/account", "signin=failed"));

  const params = req.nextUrl.searchParams;
  // The customer closed / declined Google's consent screen.
  if (params.get("error")) return clearing(back(oauth.next, "signin=cancelled"));

  const code = params.get("code");
  if (!code || params.get("state") !== oauth.state) {
    logger.warn("google_signin_state_mismatch", {});
    return clearing(back(oauth.next, "signin=failed"));
  }

  try {
    await enforceRateLimit({ key: `google_callback_ip:${clientIp(req)}`, max: 30 });
    const identity = await exchangeCodeForIdentity(code, oauth, googleRedirectUri(origin));

    const { profile, newToken } = await getOrCreateDeviceProfile(req);
    const { mergedProfiles } = await linkDeviceToVerifiedEmail(profile.id, identity.email);
    logger.info("google_signin_ok", { deviceProfileId: profile.id, mergedProfiles });

    const res = back(oauth.next, "signin=ok");
    if (newToken) attachDeviceTokenCookie(res, newToken);
    return clearing(res);
  } catch (err) {
    logger.warn("google_signin_failed", { message: err instanceof Error ? err.message : String(err) });
    return clearing(back(oauth.next, "signin=failed"));
  }
}
