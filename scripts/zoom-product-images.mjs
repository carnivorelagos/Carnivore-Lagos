/**
 * Center-crop every product photo tighter ("zoom in") so the food fills
 * the frame instead of sitting small in the middle of a lot of plate/
 * table/background — the client's exact complaint about the stock photos
 * added by generate-product-images.mjs.
 *
 *   node scripts/zoom-product-images.mjs [flags]
 *
 * Flags:
 *   --factor=0.78    Fraction of each dimension to keep, centered (default
 *                     0.78 -> ~1.28x zoom). Lower = more aggressive crop.
 *   --dir=public/products   Directory of images to process.
 *   --only=file.jpg[,file2.jpg]   Restrict to specific filenames.
 *
 * Safe to re-run: crops are computed from each image's *current* pixel
 * dimensions every time, so running it twice compounds the zoom (that's
 * usually not what you want) — re-crop from originals (git checkout the
 * file first) rather than running this twice on the same file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const FACTOR = Number(opt("factor", "0.78"));
const DIR = path.resolve(ROOT, opt("dir", "public/products"));
const ONLY = (opt("only", "") || "").split(",").map((s) => s.trim()).filter(Boolean);

if (!(FACTOR > 0 && FACTOR < 1)) {
  throw new Error(`--factor must be between 0 and 1 (got ${FACTOR})`);
}

let files = fs.readdirSync(DIR).filter((f) => /\.(jpe?g|png)$/i.test(f));
if (ONLY.length) files = files.filter((f) => ONLY.includes(f));

console.log(`Zooming ${files.length} image(s) in ${DIR} by ${(1 / FACTOR).toFixed(2)}x (center crop, factor=${FACTOR})`);

for (const file of files) {
  const p = path.join(DIR, file);
  const buf = fs.readFileSync(p);
  const meta = await sharp(buf).metadata();
  const w = meta.width;
  const h = meta.height;
  const cropW = Math.round(w * FACTOR);
  const cropH = Math.round(h * FACTOR);
  const left = Math.round((w - cropW) / 2);
  const top = Math.round((h - cropH) / 2);

  const isPng = /\.png$/i.test(file);
  let pipeline = sharp(buf)
    .extract({ left, top, width: cropW, height: cropH })
    .resize(w, h, { fit: "fill" }); // scale back up to the original dimensions
  pipeline = isPng ? pipeline.png() : pipeline.jpeg({ quality: 85 });

  fs.writeFileSync(p, await pipeline.toBuffer());
  console.log(`✓ ${file}  (${w}x${h} -> crop ${cropW}x${cropH} -> ${w}x${h})`);
}
console.log("Done.");
