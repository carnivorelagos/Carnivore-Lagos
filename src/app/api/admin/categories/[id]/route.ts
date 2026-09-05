import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { adminCategoryUpdateSchema, uuidSchema } from "@/lib/validation";
import { notFound } from "@/lib/errors";
import { revalidateCatalog } from "@/lib/cache";

/**
 * There is no DELETE route for categories — a category with products
 * can't be removed out from under them (Product.categoryId is a
 * Restrict FK). Deactivating via `{ isActive: false }` here is the only
 * supported way to retire one (Section 6/46).
 */
export const PATCH = withApiHandler(async (req: NextRequest, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const categoryId = uuidSchema.parse(id);
  const data = adminCategoryUpdateSchema.parse(await req.json());

  const existing = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!existing) throw notFound("Category");

  const category = await prisma.category.update({ where: { id: categoryId }, data });
  revalidateCatalog("categories", "products");
  return ok(category);
});
