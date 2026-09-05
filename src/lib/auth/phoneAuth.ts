import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { AppError, ErrorCode } from "../errors";
import { generateOtpCode, hashOtpCode, verifyOtpCode, OTP_TTL_MS, OTP_MAX_ATTEMPTS } from "../otp";
import { sendOtpSms } from "../sms";
import { logger } from "../logger";
import { signCustomerSession } from "./customerSession";

/**
 * One phone-entry flow for both signup and login (Section: "one unified
 * screen") — the backend decides new-vs-returning, not the client. A
 * request never reveals whether the phone number is already registered;
 * the code is texted either way.
 */
export async function requestPhoneOtp(phone: string): Promise<void> {
  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.phoneOtp.create({ data: { phone, codeHash, expiresAt } });
  await sendOtpSms(phone, code);
  logger.info("phone_otp_requested", { phone });
}

export type PhoneVerifyResult = {
  customer: {
    id: string;
    phone: string;
    name: string | null;
    email: string | null;
    emailVerifiedAt: Date | null;
  };
  isNewAccount: boolean;
  sessionToken: string;
};

/**
 * Verifying the most recent unconsumed code for this phone is enough —
 * older, still-unconsumed codes for the same number simply go stale on
 * their own TTL rather than being explicitly revoked, so there's nothing
 * to clean up when a customer requests a second code before using the
 * first.
 */
export async function verifyPhoneOtp(phone: string, code: string): Promise<PhoneVerifyResult> {
  const otp = await prisma.phoneOtp.findFirst({
    where: { phone, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    throw new AppError(ErrorCode.OTP_INVALID, "Enter your phone number again to request a new code.");
  }
  if (otp.expiresAt < new Date()) {
    throw new AppError(ErrorCode.OTP_EXPIRED, "This code has expired. Request a new one.");
  }
  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    throw new AppError(ErrorCode.OTP_INVALID, "Too many incorrect attempts. Request a new code.");
  }

  if (!verifyOtpCode(code, otp.codeHash)) {
    await prisma.phoneOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw new AppError(ErrorCode.OTP_INVALID, "Incorrect code.");
  }

  await prisma.phoneOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

  let customer = await prisma.customer.findUnique({ where: { phone } });
  let isNewAccount = false;
  if (!customer) {
    isNewAccount = true;
    try {
      customer = await prisma.customer.create({ data: { phone } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        // Lost a race to a concurrent verification for the same phone
        // (e.g. the same code entered from two tabs at once).
        customer = await prisma.customer.findUniqueOrThrow({ where: { phone } });
        isNewAccount = false;
      } else {
        throw err;
      }
    }
  }

  const sessionToken = await signCustomerSession({ customerId: customer.id, phone: customer.phone });

  logger.info("phone_otp_verified", { customerId: customer.id, isNewAccount });

  return { customer, isNewAccount, sessionToken };
}
