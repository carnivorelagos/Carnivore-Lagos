import { randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "../prisma";

/**
 * Device-based identity for no-login checkout (amendment 2).
 *
 * The token is an opaque 32-byte random string kept in an httpOnly cookie.
 * httpOnly on purpose (amendment 3): whoever holds the token can see this
 * device's order history AND charge its saved card, so it's a bearer
 * credential — not something JS should be able to read out of the page.
 * The client learns "does this device have history?" from GET /api/history,
 * never from the cookie itself.
 */

export const DEVICE_TOKEN_COOKIE = "device_token";
// 400 days — Chrome caps cookie lifetime here; long enough that a returning
// customer is recognised months later.
const DEVICE_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 400;

export type DeviceProfileRow = {
  id: string;
  token: string;
  verifiedContactEmail: string | null;
  paystackAuthorizationCode: string | null;
  paystackAuthEmail: string | null;
  paystackCardLast4: string | null;
  paystackCardBrand: string | null;
};

const SELECT = {
  id: true,
  token: true,
  verifiedContactEmail: true,
  paystackAuthorizationCode: true,
  paystackAuthEmail: true,
  paystackCardLast4: true,
  paystackCardBrand: true,
} as const;

function generateDeviceToken(): string {
  return randomBytes(32).toString("base64url");
}

export function attachDeviceTokenCookie(res: NextResponse, token: string): void {
  res.cookies.set(DEVICE_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_TOKEN_TTL_SECONDS,
  });
}

/** Read-only: the device's profile, or null if this device has none yet. */
export async function getDeviceProfile(req: NextRequest): Promise<DeviceProfileRow | null> {
  const token = req.cookies.get(DEVICE_TOKEN_COOKIE)?.value;
  if (!token) return null;
  return prisma.deviceProfile.findUnique({ where: { token }, select: SELECT });
}

/**
 * Get the device's profile, creating one if this device has never been
 * seen. `newToken` is non-null exactly when a profile was just created —
 * the caller must then `attachDeviceTokenCookie(response, newToken)` on
 * whatever response it returns. A cookie pointing at a deleted/unknown
 * profile is treated as "no profile" and a fresh one is minted.
 */
export async function getOrCreateDeviceProfile(
  req: NextRequest,
): Promise<{ profile: DeviceProfileRow; newToken: string | null }> {
  const existing = await getDeviceProfile(req);
  if (existing) return { profile: existing, newToken: null };

  const token = generateDeviceToken();
  const created = await prisma.deviceProfile.create({ data: { token }, select: SELECT });
  return { profile: created, newToken: token };
}
