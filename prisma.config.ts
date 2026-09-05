import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma CLI (generate / migrate / db push / studio) always talks to Neon's
// DIRECT (unpooled) connection — never the pooled one the running app uses.
// See DEPLOYMENT.md "Two connection strings" for why.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
