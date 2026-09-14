import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "../prisma";
import { AppError, ErrorCode } from "../errors";
import { logger } from "../logger";

/**
 * "Secure your order history" — a passwordless email magic link
 * (amendment 4). Deliberately a link + opaque token, not a 6-digit code
 * (that's EmailVerificationCode, which belongs to the retired phone-account
 * flow). Only the token's HMAC is stored; the raw token lives only in the
 * emailed URL. HMAC-SHA256 keyed by AUTH_SECRET, same reasoning as
 * src/lib/otp.ts: a read-only DB leak alone can't forge a usable link.
 */

const LINK_TTL_MS = 45 * 60_000; // 45 minutes

function pepper(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET is not set or is shorter than 32 characters — refusing to sign/verify magic links.",
    );
  }
  return Buffer.from(secret);
}

function hashToken(rawToken: string): string {
  return createHmac("sha256", pepper()).update(rawToken).digest("hex");
}

/**
 * Create a pending verification for `email` against `deviceProfileId` and
 * return the raw token. The caller builds the confirm URL and emails it.
 */
export async function createContactMagicLink(
  deviceProfileId: string,
  email: string,
): Promise<{ token: string }> {
  const token = randomBytes(32).toString("base64url");
  await prisma.contactVerification.create({
    data: {
      tokenHash: hashToken(token),
      deviceProfileId,
      email,
      expiresAt: new Date(Date.now() + LINK_TTL_MS),
    },
  });
  logger.info("contact_magic_link_created", { deviceProfileId });
  return { token };
}

export type ConsumeResult = { deviceProfileId: string; email: string };

/**
 * Validate a clicked magic link and link the confirming device to the
 * verified email. `openingDeviceProfileId` is the profile of whoever
 * clicked the link (same device that ordered, or a fresh one on another
 * device doing recovery). Every other profile that already carries this
 * verified email — including the device that *requested* the link, if
 * different — is merged into the opener: its orders and any saved card
 * move over, then it's deleted. Net effect: the confirming device ends up
 * with the full history for that email and a single profile owns it.
 */
export async function consumeContactMagicLink(
  rawToken: string,
  openingDeviceProfileId: string,
): Promise<ConsumeResult> {
  const row = await prisma.contactVerification.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });

  const invalid = () =>
    new AppError(ErrorCode.OTP_INVALID, "This link is invalid or has already been used. Request a new one.");

  if (!row) throw invalid();
  if (row.consumedAt) throw invalid();
  if (row.expiresAt < new Date()) {
    throw new AppError(ErrorCode.OTP_EXPIRED, "This link has expired. Request a new one.");
  }

  // Constant-time guard against tokenHash timing probes (findUnique already
  // matched, this is belt-and-braces to mirror otp.ts's discipline).
  const a = Buffer.from(hashToken(rawToken));
  const b = Buffer.from(row.tokenHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw invalid();

  const email = row.email;
  const targetId = openingDeviceProfileId;

  await prisma.contactVerification.update({
    where: { id: row.id },
    data: { consumedAt: new Date() },
  });

  const target = await prisma.deviceProfile.findUniqueOrThrow({ where: { id: targetId } });

  const others = await prisma.deviceProfile.findMany({
    where: {
      id: { not: targetId },
      OR: [{ verifiedContactEmail: email }, { id: row.deviceProfileId }],
    },
  });

  let carryCode = target.paystackAuthorizationCode;
  let carryEmail = target.paystackAuthEmail;
  let carryLast4 = target.paystackCardLast4;
  let carryBrand = target.paystackCardBrand;

  for (const other of others) {
    await prisma.order.updateMany({
      where: { deviceProfileId: other.id },
      data: { deviceProfileId: targetId },
    });
    if (!carryCode && other.paystackAuthorizationCode) {
      carryCode = other.paystackAuthorizationCode;
      carryEmail = other.paystackAuthEmail;
      carryLast4 = other.paystackCardLast4;
      carryBrand = other.paystackCardBrand;
    }
    await prisma.deviceProfile.delete({ where: { id: other.id } });
  }

  await prisma.deviceProfile.update({
    where: { id: targetId },
    data: {
      verifiedContactEmail: email,
      paystackAuthorizationCode: carryCode,
      paystackAuthEmail: carryEmail,
      paystackCardLast4: carryLast4,
      paystackCardBrand: carryBrand,
    },
  });

  logger.info("contact_magic_link_consumed", {
    deviceProfileId: targetId,
    mergedProfiles: others.length,
  });

  return { deviceProfileId: targetId, email };
}
