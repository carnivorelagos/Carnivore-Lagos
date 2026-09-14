import { NextRequest } from "next/server";
import { ok, withApiHandler } from "@/lib/api-response";
import { adminLoginSchema } from "@/lib/validation";
import { attemptAdminLogin } from "@/lib/auth/loginAttempt";
import { signSession, attachSessionCookie } from "@/lib/auth/session";
import { enforceRateLimit, clientIp } from "@/lib/rateLimit";
import { sendAdminLoginAlert } from "@/lib/email";
import { logger } from "@/lib/logger";

/**
 * Two independent throttling layers (Section 28): IP-based (this
 * rate-limit call, catches credential stuffing across many emails from
 * one source) and per-account lockout (inside attemptAdminLogin, catches
 * repeated guesses against one account from anywhere).
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  await enforceRateLimit({ key: `admin_login:${clientIp(req)}`, max: 10 });

  const { email, password } = adminLoginSchema.parse(await req.json());
  const admin = await attemptAdminLogin(email, password);

  const token = await signSession({ adminId: admin.id, email: admin.email, role: admin.role });
  const response = ok({ id: admin.id, email: admin.email, role: admin.role });
  attachSessionCookie(response, token);

  logger.info("admin_login_succeeded", { adminId: admin.id });

  // Security alert (awaited, not fire-and-forget: a Netlify Function can
  // freeze the instant the response is sent) — every admin sign-in, no
  // exceptions. A failed send is logged, never turns a successful login
  // into an API error.
  try {
    await sendAdminLoginAlert({
      adminEmail: admin.email,
      role: admin.role,
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
      at: new Date(),
    });
  } catch (err) {
    logger.error("admin_login_alert_failed", {
      adminId: admin.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  return response;
});
