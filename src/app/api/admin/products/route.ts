import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { adminProductCreateSchema, adminProductListQuerySchema } from "@/lib/validation";
import { revalidateCatalog } from "@/lib/cache";

export const GET = withApiHandler(async (req: NextRequest) => {
  await requireAdmin(req);
  const { searchParams } = new URL(req.url);
  const { page, limit, q } = adminProductListQuerySchema.parse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    q: searchParams.get("q") ?? undefined,
  });

  const where = q ? { name: { contains: q, mode: "insensitive" as const } } : {};

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
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
