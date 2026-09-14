import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { reorderSchema } from "@/lib/validation";
import { assertSameOrigin } from "@/lib/auth/csrf";
import { getDeviceProfile } from "@/lib/auth/deviceProfile";
import { notFound } from "@/lib/errors";

/**
 * One-tap reorder (amendment 2): given one of this device's past orders,
 * return its lines re-priced against the current menu so the client can
 * pre-fill the cart. Items that are gone or unavailable are flagged, not
 * silently dropped.
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  assertSameOrigin(req);
  const { trackingSlug } = reorderSchema.parse(await req.json());

  const device = await getDeviceProfile(req);
  const order = await prisma.order.findUnique({
    where: { trackingSlug },
    select: {
      deviceProfileId: true,
      items: { select: { productId: true, productNameSnapshot: true, quantity: true } },
    },
  });
  if (!order || !device || order.deviceProfileId !== device.id) throw notFound("Order");

  const ids = order.items.map((i) => i.productId).filter((v): v is string => !!v);
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, priceKobo: true, imageUrl: true, isActive: true, isAvailable: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines = order.items.map((i) => {
    const p = i.productId ? byId.get(i.productId) : undefined;
    const available = !!p && p.isActive && p.isAvailable;
    return {
      productId: i.productId,
      name: p?.name ?? i.productNameSnapshot,
      quantity: i.quantity,
      priceKobo: p?.priceKobo ?? null,
      imageUrl: p?.imageUrl ?? null,
      available,
    };
  });

  return ok({ lines });
});
