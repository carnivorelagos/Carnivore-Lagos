import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDeviceProfile, attachDeviceTokenCookie } from "@/lib/auth/deviceProfile";
import { consumeContactMagicLink, EMAIL_LINK_NEXT_COOKIE } from "@/lib/auth/contactVerification";
import { safeNextPath } from "@/lib/auth/safeNextPath";
import { logger } from "@/lib/logger";

/**
 * Magic-link click target (amendment 4; now also the email half of
 * "Continue with Google / Continue with email" sign-in). Not a JSON API —
 * it's a browser navigation, so it always ends in a redirect, never an
 * error body. The device that opens the link (which may be a different
 * device from the one that requested it — that's the recovery path) is
 * linked to the verified email; any other profile carrying that email is
 * merged in. Lands back on whatever page started the request (the
 * `email_link_next` cookie set by POST /api/history/secure), or /history
 * if that cookie is missing — e.g. a different device opened the link.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const { profile, newToken } = await getOrCreateDeviceProfile(req);

  let status: "1" | "failed" = "1";
  try {
    await consumeContactMagicLink(token, profile.id);
  } catch (err) {
    status = "failed";
    logger.warn("contact_magic_link_confirm_failed", {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  const next = safeNextPath(req.cookies.get(EMAIL_LINK_NEXT_COOKIE)?.value);
  const sep = next.includes("?") ? "&" : "?";
  const res = NextResponse.redirect(new URL(`${next}${sep}secured=${status}`, req.nextUrl.origin));
  res.cookies.set(EMAIL_LINK_NEXT_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/history/secure",
    maxAge: 0,
  });
  if (newToken) attachDeviceTokenCookie(res, newToken);
  return res;
}
