import { beforeAll, describe, expect, it } from "vitest";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { buildAuthorizeUrl, newOAuthState, safeNextPath, verifyGoogleIdToken } from "../src/lib/auth/google";

const CLIENT_ID = "test-client.apps.googleusercontent.com";

let signKey: CryptoKey;
let keys: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
  process.env.GOOGLE_CLIENT_SECRET = "secret";
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  signKey = privateKey;
  keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), alg: "RS256", kid: "k1" }] });
});

async function token(claims: Record<string, unknown>, opts: { aud?: string; iss?: string; exp?: string } = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(opts.iss ?? "https://accounts.google.com")
    .setAudience(opts.aud ?? CLIENT_ID)
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? "5m")
    .sign(signKey);
}

describe("verifyGoogleIdToken", () => {
  it("accepts a valid token and lower-cases the email", async () => {
    const t = await token({ email: "Ada@Gmail.com", email_verified: true, name: "Ada L", nonce: "n1" });
    expect(await verifyGoogleIdToken(t, "n1", keys)).toEqual({ email: "ada@gmail.com", name: "Ada L" });
  });

  it("rejects a wrong nonce", async () => {
    const t = await token({ email: "a@gmail.com", email_verified: true, nonce: "other" });
    await expect(verifyGoogleIdToken(t, "n1", keys)).rejects.toThrow();
  });

  it("rejects an unverified email", async () => {
    const t = await token({ email: "a@gmail.com", email_verified: false, nonce: "n1" });
    await expect(verifyGoogleIdToken(t, "n1", keys)).rejects.toThrow();
  });

  it("rejects a token minted for another client", async () => {
    const t = await token({ email: "a@gmail.com", email_verified: true, nonce: "n1" }, { aud: "someone-else" });
    await expect(verifyGoogleIdToken(t, "n1", keys)).rejects.toThrow();
  });

  it("rejects a foreign issuer", async () => {
    const t = await token({ email: "a@gmail.com", email_verified: true, nonce: "n1" }, { iss: "https://evil.example" });
    await expect(verifyGoogleIdToken(t, "n1", keys)).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    const t = await token({ email: "a@gmail.com", email_verified: true, nonce: "n1" }, { exp: "-1m" });
    await expect(verifyGoogleIdToken(t, "n1", keys)).rejects.toThrow();
  });

  it("rejects a token signed by an unknown key", async () => {
    const other = await generateKeyPair("RS256");
    const t = await new SignJWT({ email: "a@gmail.com", email_verified: true, nonce: "n1" })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer("https://accounts.google.com")
      .setAudience(CLIENT_ID)
      .setExpirationTime("5m")
      .sign(other.privateKey);
    await expect(verifyGoogleIdToken(t, "n1", keys)).rejects.toThrow();
  });
});

describe("safeNextPath", () => {
  it("keeps ordinary same-site paths", () => {
    expect(safeNextPath("/checkout")).toBe("/checkout");
    expect(safeNextPath("/history?x=1")).toBe("/history?x=1");
  });
  it("refuses open-redirect shapes and sign-in loops", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "/api/admin", "/account", "/login", "", null, undefined]) {
      expect(safeNextPath(bad as string | null | undefined)).toBe("/history");
    }
  });
});

describe("buildAuthorizeUrl", () => {
  it("asks for openid email profile with PKCE + state + nonce", () => {
    const s = newOAuthState("/checkout");
    const u = new URL(buildAuthorizeUrl(s, "https://www.carnivorelagos.com/api/auth/google/callback"));
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(u.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(u.searchParams.get("scope")).toBe("openid email profile");
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("state")).toBe(s.state);
    expect(u.searchParams.get("nonce")).toBe(s.nonce);
    expect(u.searchParams.get("redirect_uri")).toBe("https://www.carnivorelagos.com/api/auth/google/callback");
    // the verifier itself must never leave the server
    expect(u.toString()).not.toContain(s.verifier);
  });
});
