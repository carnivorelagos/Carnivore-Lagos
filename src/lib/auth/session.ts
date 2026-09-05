import { SignJWT, jwtVerify } from "jose";
import { NextResponse } from "next/server";

/**
 * Centralized session creation, verification, expiration, and cookie
 * handling — one module, so nothing scatters ad-hoc auth checks around the
 * codebase (Section 22/24). Stateless signed JWT, no server-side session
 * store — nothing to exhaust, no Redis needed.
 */

export const SESSION_COOKIE_NAME = "admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export type SessionPayload = {
  adminId: string;
  email: string;
  role: "ADMIN" | "SUPER_ADMIN";
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

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.adminId === "string" &&
      typeof payload.email === "string" &&
      (payload.role === "ADMIN" || payload.role === "SUPER_ADMIN")
    ) {
      return { adminId: payload.adminId, email: payload.email, role: payload.role };
    }
    return null;
  } catch {
    return null;
  }
}

/** Attaches the signed session cookie to an outgoing response (login). */
export function attachSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

/** Clears the session cookie (logout). */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
