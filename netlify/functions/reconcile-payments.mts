/**
 * Netlify Scheduled Function — fires every 10 minutes and pokes the
 * internal reconcile endpoint in the Next app. Kept deliberately thin: it
 * holds no business logic and no database access, it just authenticates
 * with RECONCILE_SECRET and lets the route (src/app/api/internal/
 * reconcile-payments/route.ts) do the work.
 *
 * Netlify populates `process.env.URL` with the site's primary URL at
 * runtime. RECONCILE_SECRET must be set in the site's environment
 * variables (see .env.example / DEPLOYMENT.md).
 */

export default async () => {
  const base =
    process.env.URL ??
    process.env.DEPLOY_PRIME_URL ??
    process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.RECONCILE_SECRET;

  if (!base || !secret) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "reconcile_cron_misconfigured",
        hasBase: Boolean(base),
        hasSecret: Boolean(secret),
      }),
    );
    return new Response("misconfigured", { status: 500 });
  }

  try {
    const res = await fetch(`${base}/api/internal/reconcile-payments`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    });
    const body = await res.text();
    console.log(
      JSON.stringify({
        level: res.ok ? "info" : "error",
        event: "reconcile_cron_ran",
        status: res.status,
        body: body.slice(0, 2000),
      }),
    );
    return new Response(body, { status: res.status });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "reconcile_cron_fetch_failed",
        message: err instanceof Error ? err.message : String(err),
      }),
    );
    return new Response("fetch failed", { status: 502 });
  }
};

export const config = {
  schedule: "*/10 * * * *",
};
