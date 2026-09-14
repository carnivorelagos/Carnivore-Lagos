import { NextRequest } from "next/server";
import { ok, withApiHandler } from "@/lib/api-response";
import { secureHistorySchema } from "@/lib/validation";
import { assertSameOrigin } from "@/lib/auth/csrf";
import { getOrCreateDeviceProfile, attachDeviceTokenCookie } from "@/lib/auth/deviceProfile";
import { createContactMagicLink } from "@/lib/auth/contactVerification";
import { sendHistoryMagicLink } from "@/lib/email";
import { enforceRateLimit, clientIp } from "@/lib/rateLimit";

/**
 * "Secure your order history" (amendment 4). Sends a passwordless email
 * magic link. Offered once right after order confirmation, and again on
 * the history page for recovery on a new device. Never gates anything —
 * if the customer ignores it, history just stays device-only.
 *
 * A device profile is minted here if the caller doesn't have one yet, so
 * recovery works from a brand-new device: enter the email, click the link,
 * and this device inherits the history tied to that email.
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const { email } = secureHistorySchema.parse(await req.json());

  const { profile, newToken } = await getOrCreateDeviceProfile(req);

  await enforceRateLimit({ key: `secure_history:${profile.id}`, max: 5 });
  await enforceRateLimit({ key: `secure_history_ip:${clientIp(req)}`, max: 15 });

  const { token } = await createContactMagicLink(profile.id, email);
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin).replace(/\/$/, "");
  const url = `${base}/api/history/secure/confirm?token=${encodeURIComponent(token)}`;
  await sendHistoryMagicLink(email, url);

  const res = ok({ sent: true });
  if (newToken) attachDeviceTokenCookie(res, newToken);
  return res;
});
