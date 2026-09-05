import { prisma } from "./prisma";
import { sweepAllStaleRateLimits } from "./rateLimit";
import { prunePushSubscriptions } from "./webPush";
import { logger } from "./logger";

/**
 * Periodic table hygiene for the tables that only grow under normal
 * traffic and have nowhere else to be cleaned up (this stack has no
 * long-running background process). Invoked on a schedule by the
 * reconcile cron (netlify/functions/reconcile-payments.mts →
 * POST /api/internal/reconcile-payments). Every step is best-effort and
 * independent — one failing never blocks the others.
 */

// PhoneOtp / EmailVerificationCode rows are single-use and short-lived
// (5-minute TTL). Anything this old is guaranteed dead weight.
const AUTH_CODE_RETENTION_MS = 24 * 60 * 60 * 1000; // 1 day

export type MaintenanceSummary = {
  rateLimitRowsDeleted: number;
  phoneOtpRowsDeleted: number;
  emailCodeRowsDeleted: number;
  pushSubscriptionsPruned: number;
};

export async function runMaintenance(now: Date = new Date()): Promise<MaintenanceSummary> {
  const cutoff = new Date(now.getTime() - AUTH_CODE_RETENTION_MS);

  const [rateLimitRowsDeleted, phoneOtp, emailCode, pushSubscriptionsPruned] = await Promise.all([
    sweepAllStaleRateLimits(now),
    prisma.phoneOtp
      .deleteMany({ where: { createdAt: { lt: cutoff } } })
      .catch((err) => {
        logger.error("maintenance_phone_otp_sweep_failed", {
          message: err instanceof Error ? err.message : String(err),
        });
        return { count: 0 };
      }),
    prisma.emailVerificationCode
      .deleteMany({ where: { createdAt: { lt: cutoff } } })
      .catch((err) => {
        logger.error("maintenance_email_code_sweep_failed", {
          message: err instanceof Error ? err.message : String(err),
        });
        return { count: 0 };
      }),
    prunePushSubscriptions().catch((err) => {
      logger.error("maintenance_push_prune_failed", {
        message: err instanceof Error ? err.message : String(err),
      });
      return 0;
    }),
  ]);

  const summary: MaintenanceSummary = {
    rateLimitRowsDeleted,
    phoneOtpRowsDeleted: phoneOtp.count,
    emailCodeRowsDeleted: emailCode.count,
    pushSubscriptionsPruned,
  };
  logger.info("maintenance_swept", { ...summary });
  return summary;
}
