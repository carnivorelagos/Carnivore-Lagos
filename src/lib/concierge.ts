import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { prisma } from "./prisma";
import { logger } from "./logger";
import { formatNaira } from "./money";

/**
 * AI food concierge — Layer 4 of the search pipeline, reached only when
 * deterministic search (src/lib/client/search.ts) finds nothing useful.
 *
 * Hard guarantees, enforced here, not trusted to the model:
 *  - it can only ever return products that exist and are available right
 *    now (every returned id is re-checked against the DB);
 *  - prices/names/images come from the DB row, never from the model;
 *  - if it can't reach the model or the key isn't set, the route
 *    degrades to a plain "not available" and the UI hides the feature.
 *
 * The model call is server-only, rate-limited and cached at the route.
 */

const MODEL = process.env.SEARCH_ASSIST_MODEL || "claude-opus-5";

export function conciergeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type ConciergePick = {
  productId: string;
  name: string;
  priceKobo: number;
  imageUrl: string | null;
  reason: string;
};

export type ConciergeResult =
  | { available: false; reason: string }
  | { available: true; intro: string; picks: ConciergePick[]; note: string | null; onMenu: boolean };

const recommendToolSchema = {
  type: "object" as const,
  additionalProperties: false,
  required: ["intro", "onMenu", "items"],
  properties: {
    intro: {
      type: "string",
      description: "One or two friendly sentences addressing what the customer asked for.",
    },
    onMenu: {
      type: "boolean",
      description:
        "true if the restaurant serves what they literally asked for; false if it doesn't but you're suggesting the closest alternatives.",
    },
    note: {
      type: "string",
      description:
        "Optional short note, e.g. 'We don't have burgers, but these are the closest.' Empty string if not needed.",
    },
    items: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["productId", "reason"],
        properties: {
          productId: { type: "string", description: "The exact id of a product from the MENU list." },
          reason: { type: "string", description: "One short sentence on why this fits the request." },
        },
      },
    },
  },
};

const modelOutputSchema = z.object({
  intro: z.string().max(600),
  onMenu: z.boolean(),
  note: z.string().max(400).optional().default(""),
  items: z
    .array(z.object({ productId: z.string(), reason: z.string().max(400) }))
    .max(4)
    .default([]),
});

type MenuRow = {
  id: string;
  name: string;
  description: string | null;
  priceKobo: number;
  imageUrl: string | null;
  tags: string[];
  category: { name: string };
};

async function loadMenu(): Promise<MenuRow[]> {
  return prisma.product.findMany({
    where: { isActive: true, isAvailable: true },
    select: {
      id: true,
      name: true,
      description: true,
      priceKobo: true,
      imageUrl: true,
      tags: true,
      category: { select: { name: true } },
    },
    orderBy: { category: { sortOrder: "asc" } },
  });
}

function buildSystemPrompt(menu: MenuRow[]): string {
  const lines = menu.map(
    (m) =>
      `- id:${m.id} | ${m.name} | ${formatNaira(m.priceKobo)} | ${m.category.name}` +
      (m.tags.length ? ` | tags: ${m.tags.join(", ")}` : "") +
      (m.description ? ` | ${m.description}` : ""),
  );
  return [
    "You are the concierge for a Nigerian grill restaurant. A customer has typed a free-text",
    "request into the menu search and deterministic matching found nothing. Help them using ONLY",
    "the menu below.",
    "",
    "Rules:",
    "- Recommend at most 4 items, every one taken from the MENU list by its exact id.",
    "- NEVER invent a dish, an id, or a price. If nothing fits, still suggest the closest 2-3",
    "  items and set onMenu=false with a short note explaining we don't have the exact thing.",
    "- Match on intent: spice, protein, richness, portion / sharing, budget, meal vs drink.",
    "- Keep it warm and concise. No markdown.",
    "- Always call the `recommend` tool. Do not reply with plain text.",
    "",
    "MENU:",
    ...lines,
  ].join("\n");
}

export async function runConcierge(query: string): Promise<ConciergeResult> {
  if (!conciergeConfigured()) {
    return { available: false, reason: "not_configured" };
  }

  const menu = await loadMenu();
  if (menu.length === 0) {
    return { available: false, reason: "empty_menu" };
  }
  const byId = new Map(menu.map((m) => [m.id, m]));

  let parsed: z.infer<typeof modelOutputSchema>;
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      output_config: { effort: "low" },
      system: [
        { type: "text", text: buildSystemPrompt(menu), cache_control: { type: "ephemeral" } },
      ],
      tools: [
        {
          name: "recommend",
          description: "Return menu recommendations for the customer's request.",
          input_schema: recommendToolSchema,
        },
      ],
      tool_choice: { type: "tool", name: "recommend" },
      messages: [{ role: "user", content: query.slice(0, 300) }],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      logger.error("concierge_no_tool_use", { stop: response.stop_reason });
      return { available: false, reason: "no_response" };
    }
    parsed = modelOutputSchema.parse(toolUse.input);
  } catch (err) {
    logger.error("concierge_call_failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return { available: false, reason: "call_failed" };
  }

  // Re-validate every id against the live menu; drop anything invented.
  const picks: ConciergePick[] = [];
  for (const item of parsed.items) {
    const row = byId.get(item.productId);
    if (!row) continue;
    picks.push({
      productId: row.id,
      name: row.name,
      priceKobo: row.priceKobo,
      imageUrl: row.imageUrl,
      reason: item.reason,
    });
  }

  if (picks.length === 0) {
    return { available: false, reason: "no_valid_picks" };
  }

  return {
    available: true,
    intro: parsed.intro.trim(),
    picks,
    note: parsed.note.trim() || null,
    onMenu: parsed.onMenu,
  };
}
