import { NextRequest } from "next/server";
import { z } from "zod";
import { unstable_cache } from "next/cache";
import { ok, withApiHandler } from "@/lib/api-response";
import { enforceRateLimit, clientIp } from "@/lib/rateLimit";
import { runConcierge, conciergeConfigured } from "@/lib/concierge";
import { CACHE_TAGS } from "@/lib/cache";
import { normalizeQuery } from "@/lib/client/search";

/**
 * AI concierge endpoint (Phase E). Server-only — the browser never calls
 * the model directly. Gated three ways so it stays cheap:
 *   1. per-IP rate limit,
 *   2. identical normalised queries are cached for an hour (busted on any
 *      menu edit via the `products` tag),
 *   3. the client is expected to have exhausted deterministic search
 *      (src/lib/client/search.ts) before calling this.
 */

const bodySchema = z.object({ query: z.string().trim().min(2).max(300) });

// Cache per normalised query. The menu is embedded in the model's system
// prompt, so a menu change must invalidate these — hence the products tag.
const cachedConcierge = (normalized: string) =>
  unstable_cache(() => runConcierge(normalized), ["concierge", normalized], {
    tags: [CACHE_TAGS.products],
    revalidate: 3600,
  })();

export const POST = withApiHandler(async (req: NextRequest) => {
  if (!conciergeConfigured()) {
    return ok({ available: false, reason: "not_configured" });
  }

  await enforceRateLimit({ key: `search_assist:${clientIp(req)}`, max: 12 });

  const { query } = bodySchema.parse(await req.json());
  const normalized = normalizeQuery(query);

  const result = await cachedConcierge(normalized);

  if (!result.available) return ok(result);
  return ok({
    available: true,
    intro: result.intro,
    picks: result.picks,
    note: result.note,
    onMenu: result.onMenu,
  });
});
