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
import { requireCustomer } from "@/lib/auth/requireCustomer";
import { validationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const ORDER_SELECT = {
  id: true,
  orderNumber: true,
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
 * Idempotency strategy (Section 13): the client generates `idempotencyKey`
 * once per checkout attempt and resends it on every retry (see the
 * architecture doc's "Checkout state persistence" section for how the
 * client holds onto it across a refresh). We check for an existing order
 * with that key first — cheap, avoids a wasted DB write on the common
 * "double click" case — and additionally rely on the column's `@unique`
 * constraint to resolve the rarer true-concurrent race, where two
 * requests both miss that initial check and try to insert at the same
 * instant: the loser's insert fails with Prisma error P2002, and rather
 * than surfacing that as an error we re-read and return the winner's row,
 * so the client only ever sees one order either way.
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  const session = await requireCustomer(req);
  await enforceRateLimit({ key: `order_create:${clientIp(req)}`, max: 10 });

  const body = createOrderSchema.parse(await req.json());

  const existing = await prisma.order.findUnique({
    where: { idempotencyKey: body.idempotencyKey },
    select: { ...ORDER_SELECT, customerId: true },
  });
  if (existing) {
    if (existing.customerId !== session.customerId) {
      // idempotencyKey is a fresh client-generated UUID per checkout
      // attempt — a collision with another customer's key is never
      // legitimate reuse, so this never returns someone else's order.
      throw validationError("This idempotency key is already in use.");
    }
    return ok(existing, 200);
  }

  // Backstops customerEmail from the verified account profile when the
  // client didn't resend it — guarantees payments/initialize and the
  // post-payment receipt always have somewhere to go under accounts-only
  // checkout, without requiring every client call to repeat it.
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: session.customerId } });

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
      // Order and its OrderItems in one implicit transaction). The
      // previous explicit interactive `$transaction` around this one
      // statement bought nothing and, over the Neon serverless driver,
      // held a real connection open for its duration — avoidable pool
      // pressure on the checkout hot path.
      const order = await prisma.order.create({
        data: {
          orderNumber,
          idempotencyKey: body.idempotencyKey,
          fulfillmentType: body.fulfillmentType,
          customerId: session.customerId,
          customerName: body.customerName,
          customerPhone: body.customerPhone,
          customerEmail: body.customerEmail ?? customer.email ?? undefined,
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
      return ok(order, 201);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const target = (err.meta?.target as string[] | undefined) ?? [];
        if (target.includes("idempotencyKey")) {
          // Lost the race to a concurrent identical request — return its
          // row. In practice this only fires on a same-customer double
          // submit (idempotencyKey is a fresh UUID per checkout attempt),
          // but the ownership check stays for the same reason as above.
          const winner = await prisma.order.findUnique({
            where: { idempotencyKey: body.idempotencyKey },
            select: { ...ORDER_SELECT, customerId: true },
          });
          if (winner && winner.customerId === session.customerId) return ok(winner, 200);
        }
        if (target.includes("orderNumber")) {
          // Astronomically unlikely order-number collision — retry with a
          // freshly generated number instead of failing the request.
          continue;
        }
      }
      throw err;
    }
  }

  throw new Error("Could not generate a unique order number after several attempts.");
});
