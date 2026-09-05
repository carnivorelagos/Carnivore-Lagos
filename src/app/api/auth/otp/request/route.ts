import { NextRequest } from "next/server";
import { ok, withApiHandler } from "@/lib/api-response";
import { phoneOtpRequestSchema } from "@/lib/validation";
import { requestPhoneOtp } from "@/lib/auth/phoneAuth";
import { enforceRateLimit, clientIp } from "@/lib/rateLimit";

/**
 * One request endpoint for both signup and login (Section: "one unified
 * screen") — the response never reveals whether the phone number is
 * already registered; a code is texted either way, and verifyPhoneOtp
 * decides new-vs-returning.
 *
 * Rate-limited by phone AND by IP — unlike most limits in this app,
 * abuse here has a direct SMS cost on top of the usual DoS concern.
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  const { phone } = phoneOtpRequestSchema.parse(await req.json());

  await enforceRateLimit({ key: `otp_request_phone:${phone}`, max: 5 });
  await enforceRateLimit({ key: `otp_request_ip:${clientIp(req)}`, max: 15 });

  await requestPhoneOtp(phone);

  return ok({ sent: true });
});
