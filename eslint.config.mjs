import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Route Handlers often receive an unused `req` when only `ctx` is
      // needed (or vice versa) — the Next.js convention for "intentionally
      // unused" is an underscore prefix.
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored third-party assets (swagger-ui-dist, copied verbatim by
    // scripts/sync-swagger-ui-assets.mjs) and the generated OpenAPI spec —
    // not source we own, never hand-edited.
    "public/swagger-ui/**",
    "public/openapi.json",
  ]),
]);

export default eslintConfig;
