import Fuse from "fuse.js";
import { MENU_SYNONYMS, SEARCH_STOPWORDS } from "@/lib/menuSynonyms";
import type { MenuIndexItem } from "./types";

/**
 * Deterministic menu search, layered exactly as in the product spec:
 *   1. exact  → 2. fuzzy (Fuse.js)  → 3. synonym / category
 * Only when all three come up empty does the caller fall through to the
 * AI concierge (Phase E). No network, runs on the already-fetched menu.
 */

export type SearchOutcome =
  | { kind: "empty" }
  | { kind: "results"; layer: "exact" | "fuzzy" | "synonym"; items: MenuIndexItem[] }
  | { kind: "did-you-mean"; suggestion: string; items: MenuIndexItem[] }
  | { kind: "no-match"; query: string; alternatives: MenuIndexItem[] };

export function normalizeQuery(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokens(q: string): string[] {
  return q
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !SEARCH_STOPWORDS.has(t));
}

function haystack(item: MenuIndexItem): string {
  return `${item.name} ${item.tags.join(" ")} ${item.description ?? ""}`.toLowerCase();
}

/** A small, category-spread set of fallbacks for a no-match. */
export function popularPicks(items: MenuIndexItem[], n = 3): MenuIndexItem[] {
  const byCat = new Map<string, MenuIndexItem[]>();
  for (const it of items) {
    const arr = byCat.get(it.categoryId) ?? [];
    arr.push(it);
    byCat.set(it.categoryId, arr);
  }
  // one from each of the first few categories, cheapest-first within each
  const out: MenuIndexItem[] = [];
  for (const arr of byCat.values()) {
    arr.sort((a, b) => a.priceKobo - b.priceKobo);
    if (arr[Math.floor(arr.length / 2)]) out.push(arr[Math.floor(arr.length / 2)]);
    if (out.length >= n) break;
  }
  return out.slice(0, n);
}

function expandSynonyms(qTokens: string[], q: string): string[] {
  const terms = new Set<string>();
  if (MENU_SYNONYMS[q]) MENU_SYNONYMS[q].forEach((t) => terms.add(t.toLowerCase()));
  for (const tok of qTokens) {
    if (MENU_SYNONYMS[tok]) MENU_SYNONYMS[tok].forEach((t) => terms.add(t.toLowerCase()));
  }
  return [...terms];
}

export function runSearch(rawQuery: string, items: MenuIndexItem[]): SearchOutcome {
  const q = normalizeQuery(rawQuery);
  if (!q) return { kind: "empty" };
  const qTokens = tokens(q);
  if (qTokens.length === 0 && q.length < 2) return { kind: "empty" };

  // ---- Layer 1: exact -------------------------------------------------
  const exact = items.filter((it) => {
    const h = haystack(it);
    if (h.includes(q)) return true;
    return qTokens.length > 0 && qTokens.every((t) => it.tags.includes(t));
  });
  if (exact.length > 0) return { kind: "results", layer: "exact", items: exact };

  // ---- Layer 2: fuzzy ----------------------------------------------------
  const fuse = new Fuse(items, {
    keys: [
      { name: "name", weight: 0.6 },
      { name: "tags", weight: 0.3 },
      { name: "description", weight: 0.1 },
    ],
    includeScore: true,
    threshold: 0.42,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });
  const fuzzy = fuse.search(q);
  if (fuzzy.length > 0) {
    const best = fuzzy[0];
    const bestScore = best.score ?? 1;
    // A single strong hit that the user likely mistyped → "did you mean".
    const strong = fuzzy.filter((r) => (r.score ?? 1) <= 0.25);
    if (strong.length >= 1 && bestScore <= 0.2 && !haystack(best.item).includes(q)) {
      return {
        kind: "did-you-mean",
        suggestion: best.item.name,
        items: strong.map((r) => r.item).slice(0, 8),
      };
    }
    if (bestScore <= 0.4) {
      return { kind: "results", layer: "fuzzy", items: fuzzy.slice(0, 12).map((r) => r.item) };
    }
  }

  // ---- Layer 3: synonyms / intent ------------------------------------
  const synTerms = expandSynonyms(qTokens, q);
  if (synTerms.length > 0) {
    const hits = items.filter((it) => {
      const h = haystack(it);
      return synTerms.some((t) => h.includes(t));
    });
    if (hits.length > 0) return { kind: "results", layer: "synonym", items: hits.slice(0, 16) };
  }

  return { kind: "no-match", query: rawQuery.trim(), alternatives: popularPicks(items, 3) };
}

/** Suggested chips under the search bar. */
export const POPULAR_SEARCHES = ["Chicken", "Suya", "Spicy", "Seafood", "Rice", "Sharing"];
