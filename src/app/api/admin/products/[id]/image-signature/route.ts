import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { imageSignatureRequestSchema, uuidSchema } from "@/lib/validation";
import { buildUploadSignature } from "@/lib/cloudinary";
import { notFound } from "@/lib/errors";

export const POST = withApiHandler(async (req: NextRequest, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  const productId = uuidSchema.parse(id);

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) throw notFound("Product");

  const { folder } = imageSignatureRequestSchema.parse(await req.json().catch(() => ({})));
  const signature = buildUploadSignature(folder);

  return ok(signature);
});
