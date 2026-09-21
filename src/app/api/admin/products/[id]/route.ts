import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { adminProductUpdateSchema, uuidSchema } from "@/lib/validation";
import { notFound } from "@/lib/errors";
import { revalidateCatalog } from "@/lib/cache";
import { deleteAsset } from "@/lib/cloudinary";
import { logger } from "@/lib/logger";

export const PATCH = withApiHandler(async (req: NextRequest, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const productId = uuidSchema.parse(id);
  const data = adminProductUpdateSchema.parse(await req.json());

  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) throw notFound("Product");

  const product = await prisma.product.update({ where: { id: productId }, data });
  revalidateCatalog("products");

  // Clean up the replaced photo on Cloudinary, if this update swapped one
  // in. The new upload is already fixed to `products/<productId>`
  // (buildUploadSignature) with overwrite:true, so old and new only ever
  // differ the first time a product's image moves onto that scheme (from
  // an old random-id or slug-based asset) — after that they're the same
  // asset and there is nothing to delete. Best-effort: never lets a
  // Cloudinary hiccup fail a save that already succeeded.
  if (
    data.imagePublicId &&
    existing.imagePublicId &&
    existing.imagePublicId !== data.imagePublicId
  ) {
    await deleteAsset(existing.imagePublicId).catch((err) => {
      logger.warn("cloudinary_stale_asset_cleanup_failed", {
        productId,
        publicId: existing.imagePublicId,
        message: err instanceof Error ? err.message : String(err),
      });
    });
  }

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
