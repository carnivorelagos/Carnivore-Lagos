import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import {
  CACHE_TAGS,
  CATEGORIES_REVALIDATE_SECONDS,
  cachedRead,
  catalogCdnHeaders,
} from "@/lib/cache";

const readCategories = cachedRead(
  () =>
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, sortOrder: true },
    }),
  ["active-categories", "v1"],
  { tags: [CACHE_TAGS.categories], revalidate: CATEGORIES_REVALIDATE_SECONDS },
);

export const GET = withApiHandler(async (_req: NextRequest) => {
  const categories = await readCategories();
  const res = ok(categories);
  for (const [k, v] of Object.entries(catalogCdnHeaders(CATEGORIES_REVALIDATE_SECONDS))) {
    res.headers.set(k, v);
  }
  return res as NextResponse;
});
