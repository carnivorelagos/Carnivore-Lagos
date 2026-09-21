import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { paginationSchema, uuidSchema } from "@/lib/validation";
import {
  CACHE_TAGS,
  CATALOG_REVALIDATE_SECONDS,
  cachedRead,
  catalogCdnHeaders,
} from "@/lib/cache";

type ProductPage = {
  items: {
    id: string;
    name: string;
    description: string | null;
    priceKobo: number;
    imageUrl: string | null;
    categoryId: string;
  }[];
  page: number;
  limit: number;
  total: number;
};

/**
 * Cached per (categoryId, page, limit). The DB (findMany + count) is hit
 * at most once per key per revalidate window across all function
 * instances; an admin product/category write drops every entry via
 * `revalidateCatalog`. See src/lib/cache.ts.
 */
function readProductPage(categoryId: string | undefined, page: number, limit: number): Promise<ProductPage> {
  return cachedRead(
    async () => {
      const where = {
        isActive: true,
        isAvailable: true,
        ...(categoryId ? { categoryId } : {}),
      };
      const [items, total] = await Promise.all([
        prisma.product.findMany({
          where,
          orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            name: true,
            description: true,
            priceKobo: true,
            imageUrl: true,
            categoryId: true,
          },
        }),
        prisma.product.count({ where }),
      ]);
      return { items, page, limit, total };
    },
    ["products-page", categoryId ?? "all", String(page), String(limit)],
    { tags: [CACHE_TAGS.products], revalidate: CATALOG_REVALIDATE_SECONDS },
  )();
}

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const { page, limit } = paginationSchema.parse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  const categoryIdRaw = searchParams.get("categoryId");
  const categoryId = categoryIdRaw ? uuidSchema.parse(categoryIdRaw) : undefined;

  const data = await readProductPage(categoryId, page, limit);

  const res = ok(data);
  for (const [k, v] of Object.entries(catalogCdnHeaders(CATALOG_REVALIDATE_SECONDS, ["categoryId", "page", "limit"]))) {
    res.headers.set(k, v);
  }
  return res as NextResponse;
});
