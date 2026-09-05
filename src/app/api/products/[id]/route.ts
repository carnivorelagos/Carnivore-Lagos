import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { notFound } from "@/lib/errors";
import { uuidSchema } from "@/lib/validation";
import {
  CACHE_TAGS,
  CATALOG_REVALIDATE_SECONDS,
  cachedRead,
  catalogCdnHeaders,
} from "@/lib/cache";

function readProduct(productId: string) {
  return cachedRead(
    () =>
      prisma.product.findFirst({
        where: { id: productId, isActive: true },
        select: {
          id: true,
          name: true,
          description: true,
          priceKobo: true,
          imageUrl: true,
          categoryId: true,
          isAvailable: true,
        },
      }),
    ["product-detail", productId],
    { tags: [CACHE_TAGS.products], revalidate: CATALOG_REVALIDATE_SECONDS },
  )();
}

export const GET = withApiHandler(async (_req: NextRequest, ctx) => {
  const { id } = await ctx.params;
  const productId = uuidSchema.parse(id);

  const product = await readProduct(productId);
  if (!product) throw notFound("Product");

  const res = ok(product);
  for (const [k, v] of Object.entries(catalogCdnHeaders())) res.headers.set(k, v);
  return res as NextResponse;
});
