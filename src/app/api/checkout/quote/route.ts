import { NextRequest } from "next/server";
import { ok, withApiHandler } from "@/lib/api-response";
import { checkoutQuoteSchema } from "@/lib/validation";
import { getSettings } from "@/lib/settings";
import { fetchProductsForCheckout } from "@/lib/products";
import { computeCheckout } from "@/lib/checkout";
import { getServiceArea } from "@/lib/serviceArea";

/**
 * Preview-only — runs the exact same fulfillment/range/floor sequence as
 * order creation and returns server-recalculated totals, but creates
 * nothing. The quote is not authoritative; POST /api/orders recomputes it
 * again from scratch moments later.
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  const body = checkoutQuoteSchema.parse(await req.json());
  const settings = await getSettings();
  const products = await fetchProductsForCheckout(body.items.map((i) => i.productId));

  const result = computeCheckout(
    {
      fulfillmentType: body.fulfillmentType,
      items: body.items,
      deliveryPin: body.deliveryPin,
    },
    products,
    settings,
    getServiceArea(),
  );

  return ok(result);
});
