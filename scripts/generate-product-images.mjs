/**
 * Bulk product-image generation. One run, every product, no per-item work.
 *
 *   node scripts/generate-product-images.mjs [flags]
 *
 * Flags:
 *   --dry                 Build + print every prompt and the cost estimate. Generates nothing.
 *   --force               Re-generate products that already have an imageUrl.
 *   --only=slug[,slug...]  Restrict to specific products (by name-slug).
 *   --provider=fal|openai|gemini    Override IMAGE_GEN_PROVIDER.
 *   --target=cloudinary|local       Override where images are stored (default: cloudinary if
 *                                   configured, else public/products/*.png served by Next).
 *   --concurrency=N        Parallel generations (default 3).
 *
 * Env (in .env):
 *   IMAGE_GEN_PROVIDER   "fal" (default) | "openai" | "gemini"
 *   FAL_KEY              fal.ai  — FLUX.1 schnell, ~$0.003/image
 *   OPENAI_API_KEY      OpenAI  — gpt-image-1, ~$0.04/image
 *   GEMINI_API_KEY      Google  — Imagen, cheap / free tier   (GEMINI_IMAGE_MODEL to override)
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

const COST = { fal: 0.003, openai: 0.04, gemini: 0.02 };

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
  const model = process.env.GEMINI_IMAGE_MODEL || "imagen-3.0-generate-002";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`,
    {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: "1:1" },
      }),
    },
  );
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const b64 = json?.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error(`gemini returned no image: ${JSON.stringify(json).slice(0, 300)}`);
  return Buffer.from(b64, "base64");
}

const GENERATORS = { fal: generateFal, openai: generateOpenai, gemini: generateGemini };

// --- storage: Buffer -> { imageUrl, imagePublicId } --------------
async function storeCloudinary(buf, slug) {
  const dataUri = `data:image/png;base64,${buf.toString("base64")}`;
  const r = await cloudinary.uploader.upload(dataUri, {
    folder: "products",
    public_id: slug,
    overwrite: true,
    resource_type: "image",
    transformation: [{ width: 1200, height: 1200, crop: "limit" }],
  });
  return { imageUrl: r.secure_url, imagePublicId: r.public_id };
}

function storeLocal(buf, slug) {
  const dir = path.join(ROOT, "public", "products");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${slug}.png`), buf);
  return { imageUrl: `/products/${slug}.png`, imagePublicId: null };
}

// --- run -----------------------------------------------------------
async function main() {
  const generate = GENERATORS[PROVIDER];
  if (!generate) throw new Error(`Unknown provider "${PROVIDER}". Use fal | openai | gemini.`);

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
    for (const p of todo) console.log(`• ${p.slug}\n  ${promptFor(p)}\n`);
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
        const buf = await generate(promptFor(p));
        const stored =
          TARGET === "cloudinary" ? await storeCloudinary(buf, p.slug) : storeLocal(buf, p.slug);
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
