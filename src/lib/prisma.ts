import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

/**
 * Singleton Prisma client over the Neon serverless driver adapter.
 *
 * Why this shape, specifically (Section 2 of the architecture doc):
 *
 * 1. Connects to Neon via `@prisma/adapter-neon`, which speaks Neon's
 *    HTTP/WebSocket protocol rather than holding a raw TCP Postgres
 *    connection open per invocation — the right fit for Netlify Functions'
 *    short-lived, bursty execution model.
 * 2. Always uses `DATABASE_URL` — Neon's *pooled* endpoint (hostname
 *    contains `-pooler`) — never `DIRECT_URL`. `DIRECT_URL` is read only by
 *    the Prisma CLI (see prisma.config.ts), for migrations/admin tooling,
 *    never by this running app.
 * 3. Is a true module-level singleton. Creating a new PrismaClient per
 *    request is the single most likely production bug in this stack
 *    (Section 2) — it would open a fresh adapter/connection on every
 *    invocation and defeat the whole point of the pooled endpoint.
 *    `globalThis` caching survives Next.js dev-mode hot-reload; in a
 *    production Lambda/Netlify Function, a *warm* invocation reuses the
 *    same module scope (and therefore the same client) automatically —
 *    a *cold* invocation gets a fresh one, which is expected and fine
 *    since Neon's pooled endpoint bounds concurrent connections regardless
 *    of how many separate warm instances exist.
 */

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. This must be Neon's pooled connection string " +
        "(hostname contains '-pooler') — see .env.example.",
    );
  }

  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
