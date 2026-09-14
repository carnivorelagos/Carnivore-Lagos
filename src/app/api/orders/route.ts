import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, withApiHandler } from "@/lib/api-response";
import { createOrderSchema } from "@/lib/validation";
import { getSettingsFresh } from "@/lib/settings";
import { fetchProductsForCheckout } from "@/lib/products";
import { computeCheckout } from "@/lib/checkout";
import { getServiceArea } from "@/lib/serviceArea";
import { generateOrderNumber } from "@/lib/orderNumber";
import { enforceRateLimit, clientIp } from "@/lib/rateLimit";
import { assertSameOrigin } from "@/lib/auth/csrf";
import { getOrCreateDeviceProfile, attachDeviceTokenCookie } from "@/lib/auth/deviceProfile";
import { validationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const ORDER_SELECT = {
  id: true,
  orderNumber: true,
  trackingSlug: true,
  status: true,
  fulfillmentType: true,
  subtotalKobo: true,
  deliveryFeeKobo: true,
  totalKobo: true,
  deliveryDistanceKm: true,
  createdAt: true,
  items: {
    select: {
      productId: true,
      productNameSnapshot: true,
      unitPriceKobo: true,
      quantity: true,
      lineTotalKobo: true,
    },
  },
} satisfies Prisma.OrderSelect;

const MAX_ORDER_NUMBER_ATTEMPTS = 5;

/**
 * No-login checkout (amendment 2). Ownership is a per-device profile, not
 * an account: the `device_token` httpOnly cookie identifies the device,
 * and one is minted + set on the response the first time this device
 * checks out. Same-origin is still enforced (Route Handlers get no CSRF
 * for free).
 *
 * Idempotency (Section 13): the client generates `idempotencyKey` once per
 * checkout attempt and resends it on retries. We check for an existing
 * order with that key first, and additionally rely on the column's
 * `@unique` constraint for the true-concurrent race — the loser re-reads
 * and returns the winner's row, so the client only ever sees one order.
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  assertSameOrigin(req);
  await enforceRateLimit({ key: `order_create:${clientIp(req)}`, max: 10 });

  const body = createOrderSchema.parse(await req.json());
  const { profile: device, newToken } = await getOrCreateDeviceProfile(req);

  const existing = await prisma.order.findUnique({
    where: { idempotencyKey: body.idempotencyKey },
    select: { ...ORDER_SELECT, deviceProfileId: true },
  });
  if (existing) {
    if (existing.deviceProfileId !== device.id) {
      // idempotencyKey is a fresh client-generated UUID per checkout
      // attempt — a collision with another device's key is never
      // legitimate reuse, so this never returns another device's order.
      throw validationError("This idempotency key is already in use.");
    }
    const { deviceProfileId: _drop, ...safe } = existing;
    const res = ok(safe, 200);
    if (newToken) attachDeviceTokenCookie(res, newToken);
    return res;
  }

  // Fresh, not the cached storefront copy: the order total (incl. delivery
  // fee) is money the customer is about to be charged, so it must reflect
  // the true current settings even if an admin changed them seconds ago.
  const settings = await getSettingsFresh();
  const products = await fetchProductsForCheckout(body.items.map((i) => i.productId));
  const result = computeCheckout(
    { fulfillmentType: body.fulfillmentType, items: body.items, deliveryPin: body.deliveryPin },
    products,
    settings,
    getServiceArea(),
  );

  for (let attempt = 0; attempt < MAX_ORDER_NUMBER_ATTEMPTS; attempt++) {
    const orderNumber = generateOrderNumber();
    try {
      // A single nested `create` is already atomic (Prisma writes the
      // Order and its OrderItems in one implicit transaction).
      const order = await prisma.order.create({
        data: {
          orderNumber,
          idempotencyKey: body.idempotencyKey,
          fulfillmentType: body.fulfillmentType,
          deviceProfileId: device.id,
          customerName: body.customerName,
          customerPhone: body.customerPhone,
          // Email at checkout is optional but is what a later online
          // payment (and saved-card reuse) is keyed to — backstopped from
          // the device's verified contact email when the form omitted it.
          customerEmail: body.customerEmail ?? device.verifiedContactEmail ?? undefined,
          deliveryAddress: body.deliveryAddress,
          deliveryLat: body.deliveryPin?.lat,
          deliveryLng: body.deliveryPin?.lng,
          deliveryDistanceKm: result.deliveryDistanceKm,
          notes: body.notes,
          subtotalKobo: result.subtotalKobo,
          deliveryFeeKobo: result.deliveryFeeKobo,
          totalKobo: result.totalKobo,
          items: {
            create: result.lineItems.map((li) => ({
              productId: li.productId,
              productNameSnapshot: li.productName,
              unitPriceKobo: li.unitPriceKobo,
              quantity: li.quantity,
              lineTotalKobo: li.lineTotalKobo,
            })),
          },
        },
        select: ORDER_SELECT,
      });

      logger.info("order_created", { orderNumber: order.orderNumber, totalKobo: order.totalKobo });
      const res = ok(order, 201);
      if (newToken) attachDeviceTokenCookie(res, newToken);
      return res;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const target = (err.meta?.target as string[] | undefined) ?? [];
        if (target.includes("idempotencyKey")) {
          const winner = await prisma.order.findUnique({
            where: { idempotencyKey: body.idempotencyKey },
            select: { ...ORDER_SELECT, deviceProfileId: true },
          });
          if (winner && winner.deviceProfileId === device.id) {
            const { deviceProfileId: _drop, ...safe } = winner;
            const res = ok(safe, 200);
            if (newToken) attachDeviceTokenCookie(res, newToken);
            return res;
          }
        }
        if (target.includes("orderNumber")) {
          // Astronomically unlikely order-number collision — retry.
          continue;
        }
      }
      throw err;
    }
  }

  throw new Error("Could not generate a unique order number after several attempts.");
});
