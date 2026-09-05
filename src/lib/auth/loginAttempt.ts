import { prisma } from "../prisma";
import { verifyPassword } from "./password";
import { AppError, ErrorCode } from "../errors";
import { logger } from "../logger";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export type LoginSuccess = { id: string; email: string; role: "ADMIN" | "SUPER_ADMIN" };

/**
 * The actual login-attempt logic (per-account lockout + password check),
 * factored out of the route handler so integration tests exercise the
 * exact same code path the API runs, not a re-implementation of it.
 */
export async function attemptAdminLogin(email: string, password: string): Promise<LoginSuccess> {
  const admin = await prisma.adminUser.findUnique({ where: { email } });

  const invalidCredentials = () => new AppError(ErrorCode.INVALID_CREDENTIALS, "Incorrect email or password.");

  if (!admin || !admin.isActive) {
    throw invalidCredentials();
  }

  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    throw new AppError(
      ErrorCode.ACCOUNT_LOCKED,
      `Too many failed attempts. Try again after ${admin.lockedUntil.toISOString()}.`,
    );
  }

  const passwordOk = await verifyPassword(password, admin.passwordHash);

  if (!passwordOk) {
    const failedLoginCount = admin.failedLoginCount + 1;
    const lockedUntil =
      failedLoginCount >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null;
    await prisma.adminUser.update({ where: { id: admin.id }, data: { failedLoginCount, lockedUntil } });
    logger.warn("admin_login_failed", { email, failedLoginCount });
    throw invalidCredentials();
  }

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  return { id: admin.id, email: admin.email, role: admin.role };
}
