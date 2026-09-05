import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";

/**
 * Catalog / settings caching (scaling hardening).
 *
 * The public menu is the highest-volume path in the app by a wide margin —
 * every browse and every category-tab click re-queries Postgres, and the
 * product list also runs a `count()` each time. None of that data changes
 * between admin edits, so it is wrapped in `unstable_cache` here: the DB is
 * hit at most once per `revalidate` window per distinct key, across every
 * warm function instance, and the entry is dropped immediately when an
 * admin write calls `revalidateCatalog()`.
 *
 * `unstable_cache` (not the newer `use cache`) is deliberate: on Netlify
 * the plugin backs it with a durable cache handler that survives across
 * function instances and requests, whereas the default in-memory `use
 * cache` handler does not persist in a serverless environment. See
 * node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md
 * ("Runtime caching considerations").
 */

export const CACHE_TAGS = {
  products: "catalog:products",
  categories: "catalog:categories",
  settings: "catalog:settings",
} as const;

/** Seconds a cached catalog entry is served before a background refresh. */
export const CATALOG_REVALIDATE_SECONDS = 60;
export const SETTINGS_REVALIDATE_SECONDS = 60;
export const CATEGORIES_REVALIDATE_SECONDS = 300;

/**
 * Wrap a DB read in the durable cache. `keyParts` must fully capture every
 * argument that changes the result (the closure capture that
 * `unstable_cache` also does is belt-and-braces, not relied on here).
 */
export function cachedRead<T>(
  fn: () => Promise<T>,
  keyParts: string[],
  opts: { tags: string[]; revalidate: number },
): () => Promise<T> {
  return unstable_cache(fn, keyParts, { tags: opts.tags, revalidate: opts.revalidate });
}

/**
 * Called from every admin mutation that can change what the storefront
 * shows. `profile: "max"` gives stale-while-revalidate semantics (the
 * two-argument form is the non-deprecated one in Next 16 — see
 * node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md).
 */
export function revalidateCatalog(...tags: Array<keyof typeof CACHE_TAGS>): void {
  const toClear = tags.length ? tags : (Object.keys(CACHE_TAGS) as Array<keyof typeof CACHE_TAGS>);
  for (const t of toClear) {
    revalidateTag(CACHE_TAGS[t], "max");
  }
}

/**
 * Response headers for the public catalog GET routes. Lets Netlify's CDN
 * absorb repeat traffic at the edge without reaching a function at all;
 * `stale-while-revalidate` keeps the edge serving instantly while it
 * refreshes. Harmless where a CDN ignores it.
 */
export function catalogCdnHeaders(maxAgeSeconds = CATALOG_REVALIDATE_SECONDS): Record<string, string> {
  const swr = maxAgeSeconds * 10;
  return {
    "Cache-Control": `public, max-age=0, must-revalidate`,
    "CDN-Cache-Control": `public, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${swr}`,
    "Netlify-CDN-Cache-Control": `public, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${swr}, durable`,
  };
}
