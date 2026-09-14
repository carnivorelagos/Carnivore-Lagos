import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDeviceProfile, attachDeviceTokenCookie } from "@/lib/auth/deviceProfile";
import { consumeContactMagicLink } from "@/lib/auth/contactVerification";
import { logger } from "@/lib/logger";

/**
 * Magic-link click target (amendment 4). Not a JSON API — it's a browser
 * navigation, so it always ends in a redirect to /history, never an error
 * body. The device that opens the link (which may be a different device
 * from the one that requested it — that's the recovery path) is linked to
 * the verified email; any other profile carrying that email is merged in.
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

  const res = NextResponse.redirect(new URL(`/history?secured=${status}`, req.nextUrl.origin));
  if (newToken) attachDeviceTokenCookie(res, newToken);
  return res;
}
