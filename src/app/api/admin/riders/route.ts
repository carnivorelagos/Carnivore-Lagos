import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { adminRiderCreateSchema } from "@/lib/validation";

/**
 * The restaurant's own delivery riders (Section: live tracking). No
 * password, no admin-style login — onboarding a rider is "add their name
 * and phone here, then copy them the tracking link this returns" (the
 * link is Rider.token; see /rider/[token]).
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  await requireAdmin(req);
  const riders = await prisma.rider.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] });
  return ok(riders);
});

export const POST = withApiHandler(async (req: NextRequest) => {
  await requireAdmin(req);
  const data = adminRiderCreateSchema.parse(await req.json());
  const rider = await prisma.rider.create({ data });
  return ok(rider, 201);
});
