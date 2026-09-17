/**
 * Bulk product-image generation. One run, every product, no per-item work.
 *
 *   node scripts/generate-product-images.mjs [flags]
 *
 * Flags:
 *   --dry                 Build + print every prompt and the cost estimate. Generates nothing.
 *   --force               Re-generate products that already have an imageUrl.
 *   --only=slug[,slug...]  Restrict to specific products (by name-slug).
 *   --provider=fal|openai|gemini|pexels    Override IMAGE_GEN_PROVIDER.
 *   --target=cloudinary|local       Override where images are stored (default: cloudinary if
 *                                   configured, else public/products/*.png served by Next).
 *   --concurrency=N        Parallel generations (default 3).
 *
 * Env (in .env):
 *   IMAGE_GEN_PROVIDER   "fal" (default) | "openai" | "gemini"
 *   FAL_KEY              fal.ai  — FLUX.1 schnell, ~$0.003/image
 *   OPENAI_API_KEY      OpenAI  — gpt-image-1, ~$0.04/image
 *   GEMINI_API_KEY      Google  — Gemini image-out models, ~$0.02-0.04/image. Image generation is
 *                       NOT covered by the free tier (text-only calls are); a billing-enabled
 *                       project is required. (GEMINI_IMAGE_MODEL to override, default below.)
 *   PEXELS_API_KEY      Pexels — free stock photos, $0/image, instant free key, no card.
 *                       Real stock photography of the closest matching generic dish, not an
 *                       actual photo of your food — an interim stand-in, not a generated one.
 *   CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET   (optional — see --target)
 *   DATABASE_URL        Neon pooled connection (same one the app uses)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { v2 as cloudinary } from "cloudinary";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
nextEnv.loadEnvConfig(ROOT, true);

// --- args -------------------------------------------------------------
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const DRY = flag("dry");
const FORCE = flag("force");
const ONLY = (opt("only", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
const PROVIDER = (opt("provider", process.env.IMAGE_GEN_PROVIDER) || "fal").toLowerCase();
const CONCURRENCY = Math.max(1, Number(opt("concurrency", "3")) || 3);

const cloudinaryConfigured =
  !!process.env.CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET;
const TARGET = (opt("target", cloudinaryConfigured ? "cloudinary" : "local") || "local").toLowerCase();

// --- helpers --------------------------------------------------------
function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

const STYLE =
  "Nigerian grill-house food photography, styled and appetising. " +
  "Dark slate / charred-wood surface, moody warm side-lighting, a hint of smoke, shallow depth of field. " +
  "Glossy, high detail, natural colour, square crop. " +
  "No text, no logos, no watermark, no hands, no people.";

function promptFor(product) {
  const n = product.name;
  const d = product.description ? ` ${product.description}` : "";
  const cat = product.category?.name ?? "";
  let framing = "The single dish, centred and filling the frame, plated and ready to eat.";
  if (/drink|smoothie|cocktail|mocktail/i.test(cat)) {
    framing = "Served in a glass with condensation, a garnish on the rim.";
  } else if (/platter|combo/i.test(n)) {
    framing = "An abundant spread on a large wooden board, several elements arranged.";
  } else if (/soup/i.test(cat + n)) {
    framing = "In a dark rustic bowl, steam rising, sides beside it.";
  } else if (/shawarma/i.test(cat)) {
    framing = "Wrapped in foil, one half unwrapped to show the filling.";
  }
  return `${n}.${d} ${framing} ${STYLE}`;
}

// Pexels is a keyword search, not a generator — a long AI-style prompt
// (see promptFor above) is a poor query for it, and most of these dish
// names mean nothing to an English-language stock search. Hand-mapped
// to the closest generic, recognisable dish per product for a much
// better hit rate than deriving a query from the name automatically.
const PEXELS_SEARCH_TERMS = {
  asun: "grilled goat meat spicy pepper",
  "avocado-banana-and-pear-smoothie": "avocado banana smoothie glass",
  "balangu-ram-suya": "grilled lamb skewers charcoal",
  "banana-orange-and-pineapple-smoothie": "banana orange pineapple smoothie",
  "beef-shawarma": "beef shawarma wrap",
  "beef-tozo": "grilled beef skewers charcoal",
  "bolognese-spaghetti": "spaghetti bolognese",
  "carnivore-platter": "mixed grill meat platter",
  "carrot-and-pineapple-detox-smoothie": "carrot pineapple smoothie",
  "catfish-pepper-soup": "spicy fish soup bowl",
  chapman: "red fruit cocktail drink glass",
  "chicken-lap-suya": "grilled chicken leg spicy",
  "chicken-pepper-soup": "chicken pepper soup bowl",
  "chicken-salad": "chicken salad bowl",
  "chicken-shawarma": "chicken shawarma wrap",
  "coconut-rice": "yellow spiced rice platter",
  "croaker-fish-pepper-soup": "spicy fish soup bowl",
  "fish-suya": "grilled whole fish skewer",
  "fried-rice-and-chicken-wings": "fried rice chicken wings plate",
  "giant-prawn-suya": "grilled prawns skewer",
  gizdodo: "fried plantain stew bowl",
  "gizzard-suya": "grilled chicken gizzard skewers",
  "goat-meat-pepper-soup": "goat meat pepper soup bowl",
  "grilled-chicken-wings": "grilled chicken wings plate",
  "half-chicken-suya": "grilled chicken suya skewers",
  "half-guinea-fowl-suya": "roast game bird grilled",
  "jollof-rice-and-chicken-wings": "grilled chicken orange spiced rice platter",
  "jumbo-turkey-wing-suya": "grilled turkey wing",
  "kidney-suya": "grilled meat skewers charcoal",
  "long-island": "long island iced tea cocktail",
  milkshake: "milkshake glass",
  "mixed-rice-combo": "rice chicken plantain plate",
  "mixed-shawarma": "shawarma wrap",
  mojito: "mojito cocktail glass",
  "native-rice": "rice dish with smoked fish",
  "peanut-butter-banana-smoothie": "peanut butter banana smoothie",
  "pepper-snail": "escargot spicy sauce",
  "pina-colada": "pina colada cocktail",
  "pineapple-coconut-and-banana-smoothie": "pineapple coconut smoothie",
  "ram-suya-indomie": "stir fry noodles meat",
  "ram-suya-pasta": "spaghetti with meat sauce",
  "ram-suya-shawarma": "lamb shawarma wrap",
  steak: "grilled steak plate",
  "stir-fry-spaghetti-and-chicken-wings": "stir fry spaghetti vegetables",
  tomahawk: "tomahawk steak bone",
  "turkey-pepper-soup": "turkey pepper soup bowl",
  "virgin-colada": "pina colada mocktail",
  "virgin-mojito": "virgin mojito mocktail",
  "watermelon-pineapple-and-ginger-smoothie": "watermelon smoothie glass",
};

function searchQueryFor(product) {
  return PEXELS_SEARCH_TERMS[product.slug] || `${product.name} food`;
}

const COST = { fal: 0.003, openai: 0.04, gemini: 0.02, pexels: 0 };

// --- providers: prompt -> PNG/JPEG Buffer -------------------------
async function generateFal(prompt) {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY is not set.");
  const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      image_size: "square_hd",
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: true,
    }),
  });
  if (!res.ok) throw new Error(`fal ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const url = json?.images?.[0]?.url;
  if (!url) throw new Error(`fal returned no image: ${JSON.stringify(json).slice(0, 300)}`);
  const img = await fetch(url);
  return Buffer.from(await img.arrayBuffer());
}

async function generateOpenai(prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set.");
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-image-1", prompt, n: 1, size: "1024x1024", quality: "medium" }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error(`openai returned no image: ${JSON.stringify(json).slice(0, 300)}`);
  return Buffer.from(b64, "base64");
}

async function generateGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set.");
  // Google retired the standalone Imagen `:predict` REST models in favor of
  // image output from regular Gemini models via `:generateContent` — the
  // image comes back as an inlineData part alongside (or instead of) text.
  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    },
  );
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  const b64 = parts.find((p) => p.inlineData)?.inlineData?.data;
  if (!b64) throw new Error(`gemini returned no image: ${JSON.stringify(json).slice(0, 300)}`);
  return Buffer.from(b64, "base64");
}

// Search + download, not generation — same Buffer-out signature as the
// generative providers above so it drops into the same pipeline. Keeps a
// process-wide set of photo ids already used so two products searching
// similar terms don't end up with the exact same stock photo.
const usedPexelsIds = new Set();
async function generatePexels(query) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error("PEXELS_API_KEY is not set.");
  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=8&orientation=square`,
    { headers: { Authorization: key } },
  );
  if (!res.ok) throw new Error(`pexels ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const photos = json?.photos ?? [];
  if (!photos.length) throw new Error(`pexels returned no results for "${query}"`);
  // Prefer unused photos, but still fall through to already-used ones rather
  // than give up — a search with few results shouldn't fail just because
  // another product claimed the top hit first.
  const ordered = [...photos.filter((p) => !usedPexelsIds.has(p.id)), ...photos];

  let lastErr;
  for (const photo of ordered) {
    const url = photo?.src?.large ?? photo?.src?.original;
    if (!url) continue;
    try {
      const img = await fetch(url);
      if (!img.ok) throw new Error(`download ${img.status}`);
      const buf = Buffer.from(await img.arrayBuffer());
      usedPexelsIds.add(photo.id);
      return buf;
    } catch (err) {
      // A handful of indexed Pexels photos 404/422 on their own CDN
      // (removed or reprocessing) — skip to the next candidate instead
      // of failing the whole product on one bad photo.
      lastErr = err;
    }
  }
  throw new Error(`pexels: every candidate failed for "${query}": ${lastErr?.message ?? lastErr}`);
}

const GENERATORS = {
  fal: generateFal,
  openai: generateOpenai,
  gemini: generateGemini,
  pexels: generatePexels,
};

// Every generative provider returns PNG bytes; Pexels' CDN serves JPEG.
// The file extension (and, for Cloudinary, the declared data-URI mime)
// need to match the real bytes, not be hardcoded to PNG regardless.
const OUTPUT_EXT = { fal: "png", openai: "png", gemini: "png", pexels: "jpg" };
const MIME_FOR_EXT = { png: "image/png", jpg: "image/jpeg" };

// --- storage: Buffer -> { imageUrl, imagePublicId } --------------
async function storeCloudinary(buf, slug, ext) {
  const dataUri = `data:${MIME_FOR_EXT[ext]};base64,${buf.toString("base64")}`;
  const r = await cloudinary.uploader.upload(dataUri, {
    folder: "products",
    public_id: slug,
    overwrite: true,
    resource_type: "image",
    transformation: [{ width: 1200, height: 1200, crop: "limit", quality: "auto:good" }],
  });
  return { imageUrl: r.secure_url, imagePublicId: r.public_id };
}

function storeLocal(buf, slug, ext) {
  const dir = path.join(ROOT, "public", "products");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${slug}.${ext}`), buf);
  return { imageUrl: `/products/${slug}.${ext}`, imagePublicId: null };
}

// --- run -----------------------------------------------------------
async function main() {
  const generate = GENERATORS[PROVIDER];
  if (!generate) throw new Error(`Unknown provider "${PROVIDER}". Use fal | openai | gemini | pexels.`);
  const inputFor = PROVIDER === "pexels" ? searchQueryFor : promptFor;

  if (TARGET === "cloudinary") {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");
  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

  let products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true, description: true, imageUrl: true, category: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  products = products.map((p) => ({ ...p, slug: slugify(p.name) }));
  if (ONLY.length) products = products.filter((p) => ONLY.includes(p.slug));
  const todo = FORCE ? products : products.filter((p) => !p.imageUrl);

  console.log(`Provider: ${PROVIDER}   Target: ${TARGET}`);
  console.log(`Products: ${products.length}   To generate: ${todo.length}   (skip existing: ${products.length - todo.length})`);
  console.log(`Est. cost: ~$${(todo.length * (COST[PROVIDER] ?? 0.02)).toFixed(2)}`);
  console.log("");

  if (DRY) {
    for (const p of todo) console.log(`• ${p.slug}\n  ${inputFor(p)}\n`);
    console.log("Dry run — nothing generated. Drop --dry to run for real.");
    await prisma.$disconnect();
    return;
  }
  if (!todo.length) {
    console.log("Nothing to do. Use --force to regenerate, or --only=<slug>.");
    await prisma.$disconnect();
    return;
  }

  let ok = 0;
  const failed = [];
  const queue = [...todo];

  async function worker(id) {
    while (queue.length) {
      const p = queue.shift();
      const i = todo.length - queue.length;
      try {
        const buf = await generate(inputFor(p));
        const ext = OUTPUT_EXT[PROVIDER] ?? "png";
        const stored =
          TARGET === "cloudinary"
            ? await storeCloudinary(buf, p.slug, ext)
            : storeLocal(buf, p.slug, ext);
        await prisma.product.update({ where: { id: p.id }, data: stored });
        ok++;
        console.log(`[${i}/${todo.length}] ✓ ${p.slug}  ${stored.imageUrl}`);
      } catch (err) {
        failed.push(p.slug);
        console.log(`[${i}/${todo.length}] ✗ ${p.slug}  ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, (_, i) => worker(i)));

  console.log(`\nDone. ${ok} generated, ${failed.length} failed.`);
  if (failed.length) console.log(`Retry failures: node scripts/generate-product-images.mjs --force --only=${failed.join(",")}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
