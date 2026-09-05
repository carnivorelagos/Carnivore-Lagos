# Restaurant Ordering Platform — Backend

A production backend for a restaurant ordering platform: Next.js Route Handlers, Prisma over Neon's serverless driver adapter, Paystack Inline for payments, Cloudinary for product images. See `DEPLOYMENT.md` for setup, migrations, and the production admin account process, and `API.md` for the full route surface.

This implementation follows the architecture reviewed and locked across several rounds before any code was written — schema, API contract, auth model, payment/order lifecycle, rate limiting, and every documented failure scenario. Nothing here silently deviates from that review; the one deliberate implementation refinement (payment retry re-arming a row with a fresh reference rather than literally reusing the old one, because Paystack doesn't allow re-initializing an existing reference) is called out in `src/lib/payments.ts` where it happens.

## Stack

- **Next.js** (App Router, Route Handlers) — no separate backend server, no Express/NestJS/Fastify.
- **Prisma** over **`@prisma/adapter-neon`** — the Neon serverless driver adapter, not a raw TCP connection per invocation. See `DEPLOYMENT.md` for why this matters under Netlify's concurrency model.
- **Neon Postgres** — pooled connection (`DATABASE_URL`) for the running app, direct connection (`DIRECT_URL`) for migrations only.
- **Paystack Inline** for payment, verified server-side (never trusting the frontend callback alone) and reconciled a second, independent way via webhook.
- **Cloudinary** for product images — signed direct-to-Cloudinary uploads, no binary data ever touches the app's filesystem (Netlify Functions have none to touch).
- **No Redis** — rate limiting is a DB-backed fixed-window counter (`src/lib/rateLimit.ts`).

## Getting started

```bash
npm install         # also runs `prisma generate` via postinstall
cp .env.example .env
# fill in DATABASE_URL / DIRECT_URL (a free Neon project works fine),
# AUTH_SECRET, PAYSTACK_*, CLOUDINARY_*, SEED_CONFIRM (dev only)

npm run db:migrate:dev   # applies prisma/migrations/, including the
                          # hand-verified initial migration already in
                          # this repo (see DEPLOYMENT.md "How this schema
                          # was validated")
npm run db:seed          # dev-only, guarded — see Section 23 in
                          # DEPLOYMENT.md before ever touching production

npm run dev
```

## Testing

```bash
npm test              # pure-logic unit suite — no DB, no generated
                       # Prisma client required, runs anywhere
npm run test:integration   # full suite including DB-backed tests —
                       # needs `prisma generate` to have completed
                       # against a reachable DATABASE_URL/DIRECT_URL
```

`npm test` covers, with zero external dependencies: server-side total calculation and delivery-fee rounding, the order state machine's transition allow-list, Paystack webhook signature verification and status classification, product-unavailable/price-tampering resistance, phone/cart validation, session token signing, password hashing, and — via a direct `pg` connection to a real Postgres, not the generated Prisma client — an actual proof that a failing multi-statement write rolls back atomically.

`npm run test:integration` adds: order-creation idempotency under both a sequential double-submit and a true concurrent race, the full three-way payment verify/webhook branch (success / definitive failure / still-pending) including duplicate-webhook and amount-mismatch handling, and admin login's per-account lockout.

See `DEPLOYMENT.md` → "A note on how this was built and verified" for why the split exists.
