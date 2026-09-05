import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { adminProductUpdateSchema, uuidSchema } from "@/lib/validation";
import { notFound } from "@/lib/errors";
import { revalidateCatalog } from "@/lib/cache";

export const PATCH = withApiHandler(async (req: NextRequest, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const productId = uuidSchema.parse(id);
  const data = adminProductUpdateSchema.parse(await req.json());

  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) throw notFound("Product");

  const product = await prisma.product.update({ where: { id: productId }, data });
  revalidateCatalog("products");
  return ok(product);
});

/**
 * Never a hard delete (Section 6/46) — sets isActive=false regardless of
 * whether the product is referenced by any historical order. OrderItem
 * already snapshots name/price/quantity at time of purchase, so this is
 * purely about removing the product from the live catalogue.
 */
export const DELETE = withApiHandler(async (req: NextRequest, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const productId = uuidSchema.parse(id);

  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) throw notFound("Product");

  const product = await prisma.product.update({
    where: { id: productId },
    data: { isActive: false, isAvailable: false },
  });
  revalidateCatalog("products");
  return ok(product);
});
