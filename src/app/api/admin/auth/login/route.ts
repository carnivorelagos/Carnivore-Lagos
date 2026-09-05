import { NextRequest } from "next/server";
import { ok, withApiHandler } from "@/lib/api-response";
import { adminLoginSchema } from "@/lib/validation";
import { attemptAdminLogin } from "@/lib/auth/loginAttempt";
import { signSession, attachSessionCookie } from "@/lib/auth/session";
import { enforceRateLimit, clientIp } from "@/lib/rateLimit";
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
  return response;
});
