import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { adminCategoryCreateSchema } from "@/lib/validation";
import { revalidateCatalog } from "@/lib/cache";

export const GET = withApiHandler(async (req: NextRequest) => {
  await requireAdmin(req);
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
  return ok(categories);
});

export const POST = withApiHandler(async (req: NextRequest) => {
  await requireAdmin(req);
  const data = adminCategoryCreateSchema.parse(await req.json());
  const category = await prisma.category.create({ data });
  revalidateCatalog("categories", "products");
  return ok(category, 201);
});
