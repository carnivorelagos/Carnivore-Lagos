import { prisma } from "./prisma";
import type { ProductInput } from "./checkout";

/** Fetches current DB state for exactly the requested product ids — the
 * server never trusts anything about a product from the client beyond
 * which id was requested. */
export async function fetchProductsForCheckout(ids: string[]): Promise<ProductInput[]> {
  const uniqueIds = Array.from(new Set(ids));
  const rows = await prisma.product.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, name: true, priceKobo: true, isActive: true, isAvailable: true },
  });
  return rows;
}
