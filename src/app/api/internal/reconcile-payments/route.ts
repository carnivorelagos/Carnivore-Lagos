import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { reconcilePendingPayments } from "@/lib/paymentReconcile";
import { runMaintenance } from "@/lib/maintenance";
import { logger } from "@/lib/logger";

/**
 * Internal cron endpoint — not part of the public API, not behind the
 * customer/admin session layer. Authenticated by a single shared secret
 * (`RECONCILE_SECRET`) presented as `Authorization: Bearer <secret>`.
 *
 * Called every ~10 minutes by netlify/functions/reconcile-payments.mts.
 * Safe to call by hand for an immediate pass. Does two things:
 *   1. Re-verifies stale PENDING payments against Paystack and applies
 *      any outcome that was missed (webhook gave up / customer never
 *      returned). Escalates the truly-stuck to PaymentIssue rows.
 *   2. Table hygiene: sweeps expired rate-limit and OTP rows.
 */

function authorized(req: NextRequest): boolean {
  const secret = process.env.RECONCILE_SECRET;
  if (!secret || secret.length < 16) {
    logger.error("reconcile_secret_missing", {});
    return false;
  }
  const header = req.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : header;
  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(): Promise<NextResponse> {
  const startedAt = Date.now();
  const [reconcile, maintenance] = await Promise.all([
    reconcilePendingPayments().catch((err) => {
      logger.error("reconcile_run_failed", { message: err instanceof Error ? err.message : String(err) });
      return { error: "reconcile_failed" };
    }),
    runMaintenance().catch((err) => {
      logger.error("maintenance_run_failed", { message: err instanceof Error ? err.message : String(err) });
      return { error: "maintenance_failed" };
    }),
  ]);

  return NextResponse.json({
    ok: true,
    tookMs: Date.now() - startedAt,
    reconcile,
    maintenance,
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return run();
}

// GET allowed too, for schedulers that only issue GETs. Same auth.
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return run();
}
