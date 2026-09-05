import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Runs the full suite, including `*.integration.test.ts` files that need
 * the generated Prisma client and a reachable DATABASE_URL/DIRECT_URL.
 * Run `prisma generate` first. See DEPLOYMENT.md.
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
