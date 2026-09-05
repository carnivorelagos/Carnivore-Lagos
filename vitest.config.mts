import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Default `npm test` runs only the pure-logic unit suite — no generated
 * Prisma client, no live database required, so it runs identically in any
 * environment (including one with restricted network egress, like the
 * sandbox this repo was originally built in). `*.integration.test.ts`
 * files exercise real DB behavior (idempotency races, webhook
 * processing, admin login) and are excluded here — run them explicitly
 * with `npm run test:integration` once `prisma generate` has been run
 * against a real DATABASE_URL/DIRECT_URL (see DEPLOYMENT.md).
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["**/*.integration.test.ts", "node_modules/**"],
  },
});
