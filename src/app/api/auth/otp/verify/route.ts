import { NextRequest } from "next/server";
import { ok, withApiHandler } from "@/lib/api-response";
import { phoneOtpVerifySchema } from "@/lib/validation";
import { verifyPhoneOtp } from "@/lib/auth/phoneAuth";
import { attachCustomerSessionCookie } from "@/lib/auth/customerSession";
import { enforceRateLimit, clientIp } from "@/lib/rateLimit";

export const POST = withApiHandler(async (req: NextRequest) => {
  const { phone, code } = phoneOtpVerifySchema.parse(await req.json());

  // Independent of the per-code attempt counter (which is scoped to one
  // OTP row) — caps how many different phone numbers/codes one IP can
  // try per minute.
  await enforceRateLimit({ key: `otp_verify_ip:${clientIp(req)}`, max: 20 });

  const result = await verifyPhoneOtp(phone, code);

  const response = ok({
    customer: {
      id: result.customer.id,
      phone: result.customer.phone,
      name: result.customer.name,
      email: result.customer.email,
      emailVerifiedAt: result.customer.emailVerifiedAt,
    },
    isNewAccount: result.isNewAccount,
  });
  attachCustomerSessionCookie(response, result.sessionToken);
  return response;
});
