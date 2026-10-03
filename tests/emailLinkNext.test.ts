import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Same style as googleRoutes.test.ts: mock this route's collaborators and
// test the redirect/cookie plumbing that carries `next` across the two
// requests (POST /secure sets it, GET /secure/confirm reads it back).
//
// `vi.mock` factories run during the mocked module's import, which (per ES
// module semantics) happens before this file's own top-level `const`s are
// initialized - so the mocks referenced inside a factory must come from
// `vi.hoisted`, which is itself hoisted above every `vi.mock` call.
const { createLink, consumeLink, sendMail } = vi.hoisted(() => ({
  createLink: vi.fn(async () => ({ token: "raw-token" })),
  consumeLink: vi.fn(async () => ({ deviceProfileId: "p1", email: "ada@gmail.com" })),
  sendMail: vi.fn(async () => {}),
}));

vi.mock("@/lib/rateLimit", () => ({ enforceRateLimit: vi.fn(async () => {}), clientIp: () => "1.2.3.4" }));
vi.mock("@/lib/auth/csrf", () => ({ assertSameOrigin: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendHistoryMagicLink: sendMail }));
vi.mock("@/lib/auth/deviceProfile", () => ({
  getOrCreateDeviceProfile: vi.fn(async () => ({ profile: { id: "p1" }, newToken: null })),
  attachDeviceTokenCookie: vi.fn(),
}));
// Not spread from the real module (orig()) - that module imports the Prisma
// client at top level, which throws with no DATABASE_URL set. The two
// constants are duplicated here rather than pulled from a shared import, so
// this must stay in sync with contactVerification.ts if either changes.
vi.mock("@/lib/auth/contactVerification", () => ({
  EMAIL_LINK_NEXT_COOKIE: "email_link_next",
  LINK_TTL_MS: 45 * 60_000,
  createContactMagicLink: createLink,
  consumeContactMagicLink: consumeLink,
}));

import { POST as secure } from "../src/app/api/history/secure/route";
import { GET as confirm } from "../src/app/api/history/secure/confirm/route";

const ORIGIN = "https://www.carnivorelagos.com";

const ctx = { params: Promise.resolve({}) };

function postReq(body: unknown) {
  return new NextRequest(`${ORIGIN}/api/history/secure`, {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function nextCookieFrom(res: Response): string {
  const set = res.headers.get("set-cookie") ?? "";
  const m = /email_link_next=([^;]+)/.exec(set);
  return m ? decodeURIComponent(m[1]) : "";
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = ORIGIN;
  createLink.mockClear();
  consumeLink.mockClear();
  sendMail.mockClear();
});

describe("POST /api/history/secure", () => {
  it("stores a validated next in the email_link_next cookie", async () => {
    const res = await secure(postReq({ email: "ada@gmail.com", next: "/checkout" }), ctx);
    expect(res.status).toBe(200);
    expect(nextCookieFrom(res)).toBe("/checkout");
    expect(createLink).toHaveBeenCalledWith("p1", "ada@gmail.com");
    expect(sendMail).toHaveBeenCalledWith(
      "ada@gmail.com",
      expect.stringContaining("/api/history/secure/confirm?token="),
    );
  });

  it("falls back the cookie to /history for an off-site next", async () => {
    const res = await secure(postReq({ email: "ada@gmail.com", next: "https://evil.com" }), ctx);
    expect(nextCookieFrom(res)).toBe("/history");
  });

  it("defaults the cookie to /history when no next is given", async () => {
    const res = await secure(postReq({ email: "ada@gmail.com" }), ctx);
    expect(nextCookieFrom(res)).toBe("/history");
  });

  it("scopes the cookie to the secure-link routes only", async () => {
    const res = await secure(postReq({ email: "ada@gmail.com", next: "/account" }), ctx);
    expect(res.headers.get("set-cookie")).toMatch(/Path=\/api\/history\/secure/i);
  });
});

describe("GET /api/history/secure/confirm", () => {
  const getReq = (cookie?: string) =>
    new NextRequest(`${ORIGIN}/api/history/secure/confirm?token=abc`, {
      headers: cookie ? { cookie } : {},
    });

  it("redirects to the remembered next on success, and clears the cookie", async () => {
    const res = await confirm(getReq("email_link_next=%2Faccount"));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/account?secured=1`);
    expect(consumeLink).toHaveBeenCalledWith("abc", "p1");
    expect(res.headers.get("set-cookie")).toMatch(/email_link_next=;/);
  });

  it("preserves an existing query string on the next path", async () => {
    const res = await confirm(getReq("email_link_next=%2Fcheckout%3Fx%3D1"));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/checkout?x=1&secured=1`);
  });

  it("falls back to /history with no cookie (cross-device recovery)", async () => {
    const res = await confirm(getReq());
    expect(res.headers.get("location")).toBe(`${ORIGIN}/history?secured=1`);
  });

  it("still redirects (to the remembered next) with ?secured=failed on an invalid token", async () => {
    consumeLink.mockRejectedValueOnce(new Error("bad token"));
    const res = await confirm(getReq("email_link_next=%2Faccount"));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/account?secured=failed`);
  });

  it("re-validates the cookie value rather than trusting it blindly", async () => {
    const res = await confirm(getReq("email_link_next=https://evil.com"));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/history?secured=1`);
  });
});
