import { SignJWT, jwtVerify } from "jose";
import { NextResponse } from "next/server";

/**
 * Customer-facing session — deliberately separate from admin_session
 * (session.ts): different cookie name so being logged in as an admin and
 * as a customer in the same browser never collide, and a much longer TTL
 * (30 days vs. 12 hours) because a consumer ordering app is expected to
 * keep you signed in the way Bolt/Uber-style apps do, not re-prompt for
 * an OTP every visit. Same signing mechanism as admin sessions
 * (stateless signed JWT, AUTH_SECRET) — no server-side session store.
 */

export const CUSTOMER_SESSION_COOKIE_NAME = "customer_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type CustomerSessionPayload = {
  customerId: string;
  phone: string;
};

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET is not set or is shorter than 32 characters — refusing to sign/verify sessions. Generate one with `openssl rand -base64 32`.",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signCustomerSession(payload: CustomerSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyCustomerSessionToken(token: string): Promise<CustomerSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.customerId === "string" && typeof payload.phone === "string") {
      return { customerId: payload.customerId, phone: payload.phone };
    }
    return null;
  } catch {
    return null;
  }
}

export function attachCustomerSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(CUSTOMER_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearCustomerSessionCookie(response: NextResponse): void {
  response.cookies.set(CUSTOMER_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
