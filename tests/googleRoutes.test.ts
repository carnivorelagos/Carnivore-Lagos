import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// The routes' collaborators that touch the database / network are mocked;
// what's under test is the redirect/cookie/state logic in the route files.
const link = vi.fn(async () => ({ mergedProfiles: 1 }));
const identity = vi.fn(async () => ({ email: "ada@gmail.com", name: "Ada" }));
vi.mock("@/lib/rateLimit", () => ({ enforceRateLimit: vi.fn(async () => {}), clientIp: () => "1.2.3.4" }));
vi.mock("@/lib/auth/deviceProfile", () => ({
  getOrCreateDeviceProfile: vi.fn(async () => ({ profile: { id: "p1" }, newToken: "tok-new" })),
  attachDeviceTokenCookie: (res: { cookies: { set: (n: string, v: string) => void } }, t: string) =>
    res.cookies.set("device_token", t),
}));
vi.mock("@/lib/auth/contactVerification", () => ({ linkDeviceToVerifiedEmail: (...a: unknown[]) => (link as unknown as (...x: unknown[]) => unknown)(...a) }));
vi.mock("@/lib/auth/google", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/google")>()),
  exchangeCodeForIdentity: () => identity(),
}));

import { GET as start } from "../src/app/api/auth/google/start/route";
import { GET as callback } from "../src/app/api/auth/google/callback/route";

const ORIGIN = "https://www.carnivorelagos.com";
const req = (path: string, cookie?: string) =>
  new NextRequest(`${ORIGIN}${path}`, { headers: cookie ? { cookie } : {} });

beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = ORIGIN;
  process.env.GOOGLE_CLIENT_ID = "cid";
  process.env.GOOGLE_CLIENT_SECRET = "csecret";
  link.mockClear();
  identity.mockClear();
});

function stateCookie(res: Response) {
  const set = res.headers.get("set-cookie") ?? "";
  const m = /g_oauth=([^;]+)/.exec(set);
  return m ? decodeURIComponent(m[1]) : "";
}

describe("GET /api/auth/google/start", () => {
  it("redirects to Google with the state cookie set", async () => {
    const res = await start(req("/api/auth/google/start?next=/checkout"));
    expect(res.status).toBe(307);
    const to = new URL(res.headers.get("location")!);
    expect(to.host).toBe("accounts.google.com");
    const saved = JSON.parse(stateCookie(res));
    expect(saved.state).toBe(to.searchParams.get("state"));
    expect(saved.next).toBe("/checkout");
    expect(to.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/auth/google/callback`);
    expect(res.headers.get("set-cookie")).toMatch(/HttpOnly/i);
  });

  it("bounces back (no Google redirect) when not configured", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    const res = await start(req("/api/auth/google/start?next=/checkout"));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/checkout?signin=unavailable`);
  });

  it("won't redirect to an off-site next", async () => {
    const res = await start(req("/api/auth/google/start?next=https://evil.com"));
    expect(JSON.parse(stateCookie(res)).next).toBe("/history");
  });
});

describe("GET /api/auth/google/callback", () => {
  const cookie = (o: object) => `g_oauth=${encodeURIComponent(JSON.stringify(o))}`;
  const saved = { state: "S", nonce: "N", verifier: "V", next: "/checkout" };

  it("links the device and returns the customer to where they started", async () => {
    const res = await callback(req("/api/auth/google/callback?code=abc&state=S", cookie(saved)));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/checkout?signin=ok`);
    expect(link).toHaveBeenCalledWith("p1", "ada@gmail.com");
    const set = res.headers.get("set-cookie") ?? "";
    expect(set).toMatch(/device_token=tok-new/);
    expect(set).toMatch(/g_oauth=;/); // one-shot state cookie cleared
  });

  it("rejects a mismatched state without linking anything", async () => {
    const res = await callback(req("/api/auth/google/callback?code=abc&state=WRONG", cookie(saved)));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/checkout?signin=failed`);
    expect(link).not.toHaveBeenCalled();
    expect(identity).not.toHaveBeenCalled();
  });

  it("rejects a callback with no state cookie", async () => {
    const res = await callback(req("/api/auth/google/callback?code=abc&state=S"));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/account?signin=failed`);
    expect(link).not.toHaveBeenCalled();
  });

  it("handles the customer declining Google's consent screen", async () => {
    const res = await callback(req("/api/auth/google/callback?error=access_denied&state=S", cookie(saved)));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/checkout?signin=cancelled`);
    expect(link).not.toHaveBeenCalled();
  });

  it("fails safe when Google's token can't be verified", async () => {
    identity.mockRejectedValueOnce(new Error("bad token"));
    const res = await callback(req("/api/auth/google/callback?code=abc&state=S", cookie(saved)));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/checkout?signin=failed`);
    expect(link).not.toHaveBeenCalled();
  });
});
