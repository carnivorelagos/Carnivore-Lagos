import { prisma } from "./prisma";
import { AppError, ErrorCode } from "./errors";

const WINDOW_MS = 60_000; // 1-minute fixed windows
const SWEEP_WINDOWS_TO_KEEP = 5; // delete anything older than 5 windows back

// The per-key sweep below only ever deletes stale rows for the key being
// checked — keys that are never seen again (every one-time visitor IP,
// every phone number) would otherwise accumulate forever. On a small
// fraction of calls we also do a global sweep of every stale row, which
// bounds table growth with no extra infrastructure. `runMaintenance()`
// (src/lib/maintenance.ts, called from the reconcile cron) does the same
// thing on a fixed schedule; this is the opportunistic backstop.
const GLOBAL_SWEEP_PROBABILITY = 0.02;

function currentWindowStart(now: Date): Date {
  return new Date(Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS);
}

/** Delete every rate-limit row older than the retention window, any key. */
export async function sweepAllStaleRateLimits(now: Date = new Date()): Promise<number> {
  const windowStart = currentWindowStart(now);
  const staleBefore = new Date(windowStart.getTime() - SWEEP_WINDOWS_TO_KEEP * WINDOW_MS);
  const res = await prisma.rateLimit
    .deleteMany({ where: { windowStart: { lt: staleBefore } } })
    .catch(() => ({ count: 0 }));
  return res.count;
}

/**
 * DB-backed fixed-window rate limiter (Section 28) — no Redis. Each call
 * opportunistically deletes its own stale rows before upserting its own
 * counter, so the table stays small as a side effect of normal traffic
 * rather than needing a scheduled sweep job this stack has nowhere to run
 * (Netlify Functions have no long-running background process).
 *
 * Known, accepted limitation: a fixed-window counter isn't perfectly
 * precise right at a window boundary under extreme concurrent bursts.
 * That's the right trade-off at this restaurant's MVP scale — a real,
 * honest control with no new infrastructure, not a fragile one.
 *
 * Throws AppError(RATE_LIMITED) when the limit is exceeded; callers just
 * await this before doing real work.
 */
export async function enforceRateLimit(params: {
  key: string;
  max: number;
  now?: Date;
}): Promise<void> {
  const now = params.now ?? new Date();
  const windowStart = currentWindowStart(now);
  const staleBefore = new Date(windowStart.getTime() - SWEEP_WINDOWS_TO_KEEP * WINDOW_MS);

  // Opportunistic sweep — best-effort, never blocks the actual check.
  await prisma.rateLimit
    .deleteMany({ where: { key: params.key, windowStart: { lt: staleBefore } } })
    .catch(() => undefined);

  // Occasionally sweep every key, so rows for keys never seen again
  // don't accumulate. Cheap: one indexed range delete, ~2% of calls.
  if (Math.random() < GLOBAL_SWEEP_PROBABILITY) {
    await prisma.rateLimit
      .deleteMany({ where: { windowStart: { lt: staleBefore } } })
      .catch(() => undefined);
  }

  const row = await prisma.rateLimit.upsert({
    where: { key_windowStart: { key: params.key, windowStart } },
    create: { key: params.key, windowStart, count: 1 },
    update: { count: { increment: 1 } },
  });

  if (row.count > params.max) {
    throw new AppError(
      ErrorCode.RATE_LIMITED,
      "Too many requests. Please wait a moment and try again.",
    );
  }
}

/** Best-effort client IP extraction behind Netlify's proxy. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-nf-client-connection-ip") ?? req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}
