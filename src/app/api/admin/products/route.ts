import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { adminProductCreateSchema, paginationSchema } from "@/lib/validation";
import { revalidateCatalog } from "@/lib/cache";

export const GET = withApiHandler(async (req: NextRequest) => {
  await requireAdmin(req);
  const { searchParams } = new URL(req.url);
  const { page, limit } = paginationSchema.parse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count(),
  ]);

  return ok({ items, page, limit, total });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  await requireAdmin(req);
  const data = adminProductCreateSchema.parse(await req.json());
  const product = await prisma.product.create({ data });
  revalidateCatalog("products");
  return ok(product, 201);
});
