/**
 * Curated synonym / intent map for the deterministic search layers (see
 * src/lib/client/search.ts). Keys and values are lowercase. A query term
 * that matches a key is expanded with all of its values before fuzzy
 * matching — so "wings" finds "chicken wings", "snail" finds "pepper
 * snail", "grill" pulls the whole grill section, etc.
 *
 * This is intentionally small and hand-maintained. It is NOT where broad
 * natural-language understanding lives — that's the AI concierge
 * (Phase E). Keep entries specific to this menu's vocabulary.
 */
export const MENU_SYNONYMS: Record<string, string[]> = {
  // proteins / cuts
  chicken: ["chicken", "wings", "lap", "suya"],
  wings: ["chicken wings", "grilled chicken wings"],
  beef: ["beef", "tozo", "shawarma"],
  goat: ["goat", "asun"],
  ram: ["ram", "balangu", "suya"],
  turkey: ["turkey", "jumbo turkey wing"],
  fish: ["fish", "croaker", "tilapia", "catfish", "pepper soup"],
  snail: ["pepper snail"],
  prawn: ["prawn", "giant prawn suya"],
  gizzard: ["gizzard", "gizdodo"],
  steak: ["steak", "tomahawk"],

  // dishes / formats
  rice: ["rice", "jollof", "fried rice", "native rice", "coconut rice", "mixed rice"],
  jollof: ["jollof rice"],
  pasta: ["pasta", "spaghetti", "bolognese"],
  noodles: ["indomie", "stir-fry indomie"],
  indomie: ["ram suya indomie"],
  shawarma: ["chicken shawarma", "beef shawarma", "mixed shawarma", "ram suya shawarma"],
  soup: ["pepper soup"],
  "pepper soup": ["goat meat pepper soup", "chicken pepper soup", "catfish pepper soup"],
  salad: ["chicken salad"],
  platter: ["carnivore platter"],
  combo: ["meal combo", "mixed rice combo"],

  // drinks
  drink: ["milkshake", "smoothie", "cocktail", "mocktail"],
  smoothie: ["smoothie"],
  shake: ["milkshake"],
  milkshake: ["milkshake"],
  cocktail: ["long island", "pina colada", "mojito"],
  mocktail: ["chapman", "virgin mojito", "virgin colada"],
  juice: ["smoothie", "detox smoothie"],

  // intent-ish (still deterministic — maps to tags or names)
  spicy: ["suya", "pepper", "asun", "yaji"],
  grill: ["suya", "grilled", "balangu", "asun", "tozo", "steak", "tomahawk"],
  grilled: ["grilled", "suya"],
  seafood: ["fish", "prawn", "snail", "croaker", "catfish", "tilapia"],
  meat: ["suya", "beef", "goat", "ram", "asun", "tozo", "steak"],
  sharing: ["platter", "carnivore platter"],
  cheap: [],
  vegetarian: [],
  vegan: [],
};

/** Words we don't want to expand or fuzz on. */
export const SEARCH_STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "some",
  "something",
  "any",
  "of",
  "for",
  "with",
  "and",
  "or",
  "me",
  "i",
  "want",
  "would",
  "like",
  "please",
  "get",
  "need",
  "looking",
  "craving",
]);
