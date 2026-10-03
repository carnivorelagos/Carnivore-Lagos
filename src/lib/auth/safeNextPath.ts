/**
 * Validates a same-site path used as a post-auth redirect target. Shared by
 * "Continue with Google" (google.ts) and the email magic-link sign-in
 * (contactVerification.ts / the /api/history/secure routes) - both only
 * ever want to send the customer back to a page on this site, never off it.
 *
 * Blocks protocol-relative/backslash tricks and API routes. /login is
 * excluded (it redirects to /account, so it's never a destination), but
 * /account itself IS a valid target - it's where "you're signed in" surfaces
 * after either flow completes.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/history";
  if (raw.startsWith("/api/") || raw.startsWith("/login")) return "/history";
  return raw;
}
