import { NextRequest } from "next/server";
import { ok, withApiHandler } from "@/lib/api-response";
import { assertSameOrigin } from "@/lib/auth/csrf";
import { DEVICE_TOKEN_COOKIE } from "@/lib/auth/deviceProfile";

/**
 * "Sign out": forget this device. The cookie is the only thing that ties a
 * browser to its history and saved card, so dropping it makes the browser a
 * fresh guest. Nothing is deleted - the history stays under the verified
 * email and comes back the next time that email signs in (Google or link).
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const res = ok({ signedOut: true });
  res.cookies.set(DEVICE_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
});
