import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import {
  CACHE_TAGS,
  CATALOG_REVALIDATE_SECONDS,
  cachedRead,
  catalogCdnHeaders,
} from "@/lib/cache";

/**
 * The full active + available menu in one payload, for the client-side
 * smart search (Fuse.js runs over this). ~60 rows for this restaurant, so
 * shipping it all once is cheaper than paginating the search. Cached +
 * CDN-cacheable; invalidated on any admin product/category write.
 */
const readMenuIndex = cachedRead(
  () =>
    prisma.product.findMany({
      where: { isActive: true, isAvailable: true },
      orderBy: [{ categoryId: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        description: true,
        priceKobo: true,
        imageUrl: true,
        categoryId: true,
        tags: true,
      },
    }),
  ["menu-index", "v1"],
  { tags: [CACHE_TAGS.products], revalidate: CATALOG_REVALIDATE_SECONDS },
);

export const GET = withApiHandler(async (_req: NextRequest) => {
  const items = await readMenuIndex();
  const res = ok({ items });
  for (const [k, v] of Object.entries(catalogCdnHeaders())) res.headers.set(k, v);
  return res as NextResponse;
});
