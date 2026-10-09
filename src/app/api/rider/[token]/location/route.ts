import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { assertSameOrigin } from "@/lib/auth/csrf";
import { notFound } from "@/lib/errors";
import { riderLocationUpdateSchema, riderTokenSchema } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rateLimit";

/**
 * One heartbeat from the rider's own tracking page (Section: live
 * tracking) — overwrites the rider's last-known position, never logs a
 * trail. The token in the URL is the only credential (no cookie, so this
 * isn't exploitable via the ambient-credential attacks SameSite/Origin
 * checks exist for) — assertSameOrigin is still applied as a second,
 * cheap layer, same spirit as every other mutating route.
 */
export const POST = withApiHandler(async (req: NextRequest, ctx) => {
  assertSameOrigin(req);
  const { token } = await ctx.params;
  const parsed = riderTokenSchema.safeParse(token);
  if (!parsed.success) throw notFound("Rider");

  const { lat, lng } = riderLocationUpdateSchema.parse(await req.json());

  // Generous relative to the ~15s client cadence — this guards against a
  // runaway client/bug, not normal use.
  await enforceRateLimit({ key: `rider_location:${parsed.data}`, max: 30 });

  const rider = await prisma.rider.findUnique({ where: { token: parsed.data } });
  if (!rider || !rider.isActive) throw notFound("Rider");

  await prisma.rider.update({
    where: { id: rider.id },
    data: { lastLat: lat, lastLng: lng, lastSeenAt: new Date() },
  });

  return ok({ ok: true });
});
