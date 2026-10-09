import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { adminRiderUpdateSchema, uuidSchema } from "@/lib/validation";
import { notFound } from "@/lib/errors";

export const PATCH = withApiHandler(async (req: NextRequest, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const riderId = uuidSchema.parse(id);
  const data = adminRiderUpdateSchema.parse(await req.json());

  const existing = await prisma.rider.findUnique({ where: { id: riderId } });
  if (!existing) throw notFound("Rider");

  const rider = await prisma.rider.update({ where: { id: riderId }, data });
  return ok(rider);
});

/**
 * Deactivate, not delete — same reasoning as products/categories. A
 * deactivated rider's tracking link (/rider/[token]) stops working
 * (404s, same as a soft-deleted order) and they drop out of the "assign a
 * rider" list, but any order they already delivered keeps the relation.
 */
export const DELETE = withApiHandler(async (req: NextRequest, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const riderId = uuidSchema.parse(id);

  const existing = await prisma.rider.findUnique({ where: { id: riderId } });
  if (!existing) throw notFound("Rider");

  const rider = await prisma.rider.update({ where: { id: riderId }, data: { isActive: false } });
  return ok(rider);
});
