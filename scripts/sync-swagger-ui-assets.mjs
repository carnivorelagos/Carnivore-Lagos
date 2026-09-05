// Copies the static swagger-ui-dist assets this app actually serves
// (CSS + bundle JS, no server, no React renderer bundled) into public/,
// so /api-docs works with zero runtime dependency on any external CDN.
// Run automatically by `npm install` (see package.json postinstall) and
// safe to re-run any time — always mirrors whatever version of
// swagger-ui-dist is installed.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "swagger-ui-dist");
const dest = join(root, "public", "swagger-ui");

mkdirSync(dest, { recursive: true });

const files = ["swagger-ui.css", "swagger-ui-bundle.js", "swagger-ui-standalone-preset.js"];
for (const f of files) {
  copyFileSync(join(src, f), join(dest, f));
}
console.log(`Synced ${files.length} swagger-ui-dist assets to public/swagger-ui/`);
