import { prisma } from "../prisma";
import { AppError, ErrorCode } from "../errors";
import { generateOtpCode, hashOtpCode, verifyOtpCode, OTP_TTL_MS, OTP_MAX_ATTEMPTS } from "../otp";
import { sendEmailVerificationCode } from "../email";
import { logger } from "../logger";

/**
 * Second, separate verification step of signup — a Customer always
 * exists by this point (phoneAuth.verifyPhoneOtp already created it), so
 * this is keyed by customerId, not by the email address itself.
 */
export async function requestEmailVerification(customerId: string, email: string): Promise<void> {
  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  // Save the pending address now, unverified — lets a dropped-off
  // verification resume without re-typing the email, and gives
  // emailVerifiedAt an unambiguous address to eventually mark verified
  // against (Section: payment initialize checks this field).
  await prisma.customer.update({ where: { id: customerId }, data: { email, emailVerifiedAt: null } });
  await prisma.emailVerificationCode.create({ data: { customerId, email, codeHash, expiresAt } });
  await sendEmailVerificationCode(email, code);
  logger.info("email_verification_requested", { customerId });
}

export async function confirmEmailVerification(customerId: string, code: string): Promise<void> {
  const verification = await prisma.emailVerificationCode.findFirst({
    where: { customerId, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!verification) {
    throw new AppError(ErrorCode.OTP_INVALID, "Request a new verification code.");
  }
  if (verification.expiresAt < new Date()) {
    throw new AppError(ErrorCode.OTP_EXPIRED, "This code has expired. Request a new one.");
  }
  if (verification.attempts >= OTP_MAX_ATTEMPTS) {
    throw new AppError(ErrorCode.OTP_INVALID, "Too many incorrect attempts. Request a new code.");
  }

  if (!verifyOtpCode(code, verification.codeHash)) {
    await prisma.emailVerificationCode.update({ where: { id: verification.id }, data: { attempts: { increment: 1 } } });
    throw new AppError(ErrorCode.OTP_INVALID, "Incorrect code.");
  }

  await prisma.$transaction([
    prisma.emailVerificationCode.update({ where: { id: verification.id }, data: { consumedAt: new Date() } }),
    prisma.customer.update({ where: { id: customerId }, data: { emailVerifiedAt: new Date() } }),
  ]);

  logger.info("email_verified", { customerId });
}
