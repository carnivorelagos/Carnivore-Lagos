import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { AppError, ErrorCode } from "../errors";

/**
 * "Continue with Google" — the OpenID Connect authorization-code flow with
 * PKCE, done by hand (no auth library) since all we need from Google is a
 * verified email address. That email plays exactly the role the
 * "secure your order history" magic link plays: proof that this device's
 * owner controls it, so the device is linked to that email's history and
 * saved card (see linkDeviceToVerifiedEmail). It is never required to order.
 *
 * Off until GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET are set — the UI hides
 * the button and the routes bounce back with an error.
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export const GOOGLE_OAUTH_COOKIE = "g_oauth";
export const GOOGLE_OAUTH_TTL_SECONDS = 10 * 60;

export function isGoogleConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID?.trim() && !!process.env.GOOGLE_CLIENT_SECRET?.trim();
}

function credentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Google sign-in is not configured.");
  }
  return { clientId, clientSecret };
}

export function googleRedirectUri(origin: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? origin).replace(/\/$/, "");
  return `${base}/api/auth/google/callback`;
}

/**
 * Only same-site page paths may be used as the post-login destination, so
 * the flow can't be turned into an open redirect. Never back into /account
 * or /login either (they're the sign-in screens themselves).
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/history";
  if (raw.startsWith("/api/") || raw.startsWith("/login") || raw.startsWith("/account")) return "/history";
  return raw;
}

export type OAuthState = { state: string; nonce: string; verifier: string; next: string };

export function newOAuthState(next: string): OAuthState {
  return {
    state: randomBytes(24).toString("base64url"),
    nonce: randomBytes(24).toString("base64url"),
    verifier: randomBytes(48).toString("base64url"),
    next,
  };
}

export function buildAuthorizeUrl(s: OAuthState, redirectUri: string): string {
  const { clientId } = credentials();
  const challenge = createHash("sha256").update(s.verifier).digest("base64url");
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: s.state,
    nonce: s.nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return url.toString();
}

let jwks: JWTVerifyGetKey | null = null;

export type GoogleIdentity = { email: string; name: string | null };

/**
 * Verifies a Google ID token: signature (Google's published keys), issuer,
 * audience (our client id), expiry, nonce, and email_verified. `keys` is
 * injectable for tests.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  expectedNonce: string,
  keys?: JWTVerifyGetKey,
): Promise<GoogleIdentity> {
  const { clientId } = credentials();
  jwks ??= createRemoteJWKSet(new URL(CERTS_URL));
  const { payload } = await jwtVerify(idToken, keys ?? jwks, {
    issuer: ISSUERS,
    audience: clientId,
  });
  if (payload.nonce !== expectedNonce) throw new Error("nonce mismatch");
  if (payload.email_verified !== true || typeof payload.email !== "string") {
    throw new Error("email not verified by Google");
  }
  return {
    email: payload.email.trim().toLowerCase(),
    name: typeof payload.name === "string" ? payload.name : null,
  };
}

export async function exchangeCodeForIdentity(
  code: string,
  s: OAuthState,
  redirectUri: string,
): Promise<GoogleIdentity> {
  const { clientId, clientSecret } = credentials();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: s.verifier,
    }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as { id_token?: string } | null;
  if (!res.ok || !body?.id_token) throw new Error(`token exchange failed (${res.status})`);
  return verifyGoogleIdToken(body.id_token, s.nonce);
}
