# Deployment

## ⚠️ Rotate the Neon credential before launch

An earlier revision of `.env.example` (committed) contained a real Neon
connection string, password included. Treat that database password as
compromised: in the Neon console, reset the `neondb_owner` password (or
create a fresh role), then update `DATABASE_URL` / `DIRECT_URL` in every
environment (local `.env`, Netlify env vars). `.env.example` now holds
placeholders only — keep it that way.

While you're there: `AUTH_SECRET` must be 32+ characters (the code now
refuses to start otherwise) and must be a value that has never been in
source control.

## Prisma ↔ Neon connection architecture

Two connection strings, two different consumers, on purpose (Section 2):

| Variable | Neon endpoint | Used by |
|---|---|---|
| `DATABASE_URL` | **Pooled** (hostname contains `-pooler`) | The running app, exclusively — `src/lib/prisma.ts`, via `@prisma/adapter-neon` |
| `DIRECT_URL` | **Direct/unpooled** | The Prisma CLI only — `prisma migrate`, `prisma generate`, `prisma studio` (configured in `prisma.config.ts`) — and pgAdmin |

**How it connects:** `@prisma/adapter-neon` wraps `@neondatabase/serverless`, which speaks Neon's HTTP/WebSocket protocol rather than holding a raw TCP Postgres connection open. That's the right fit for Netlify Functions' short-lived, bursty execution model — a function that only lives for a few hundred milliseconds doesn't need (and shouldn't hold) a long-lived TCP connection.

**Why concurrent Netlify invocations don't exhaust Neon's connection limit:** two things together. First, `DATABASE_URL` points at Neon's *pooled* endpoint, which fans a large number of logical client connections out over a small number of real Postgres connections on Neon's side. Second, `src/lib/prisma.ts` is a true module-level singleton (`globalThis` caching) — a *warm* Netlify Function invocation reuses the same client and doesn't open a new connection at all; only a *cold* invocation creates a fresh one, and the pooled endpoint absorbs that fine at this application's scale. **Never instantiate `new PrismaClient()` inside a route handler** — that's the single most likely production bug in this stack, and it's why `prisma.ts` exists as the only place the client is constructed.

**Client generation output:** default `@prisma/client` location (no custom `output` in `schema.prisma`) — kept deliberately simple rather than reaching for Prisma 7's custom-output generator pattern, which adds moving parts this MVP doesn't need.

## Migrations

Prisma migrations are the schema source of truth (Section 3/43) — **never hand-edit a production table in pgAdmin.** pgAdmin is for inspection, ad-hoc queries, and troubleshooting only.

```bash
npm run db:migrate:dev      # local development — creates/applies migrations, regenerates the client
npm run db:migrate:deploy   # production — applies existing migrations only, never generates new ones
```

`prisma.config.ts` points the CLI at `DIRECT_URL` (see above) — migrations never run through the pooled endpoint.

The `20260901000000_payment_issue` migration (adds the `PaymentIssue`
table + two enums) was hand-written to match `schema.prisma`, same as the
initial migration. `prisma migrate deploy` applies it normally. Until it
is applied, payment processing still works — `recordPaymentIssue` and the
reconciler swallow the "table does not exist" error and fall back to a log
line — but the `/admin/payments` page will error.

The `20260901010000_concierge_and_notifications` migration adds the
`Notification` and `PushSubscription` tables, the `NotificationType` enum,
two `OrderStatus` values (`OUT_FOR_DELIVERY`, `DELIVERED`),
`Product.tags`, `Customer.orderUpdatesOptOut`, and
`RestaurantSettings.autoConfirmPaidOrders`. It contains two
`ALTER TYPE "OrderStatus" ADD VALUE` statements — fine inside a
transaction on Neon (PG16+) because the new values aren't *used* in the
same migration; if `migrate deploy` ever rejects them, run those two
lines manually against `DIRECT_URL` first, then re-run deploy. After
applying, run `npm run db:seed` again (dev) so products pick up their
attribute tags.

### A note on how this schema was validated

This repository was originally built inside a network-restricted sandbox that could reach `registry.npmjs.org` but not `binaries.prisma.sh`, the host Prisma's CLI fetches its schema-engine binary from — so `prisma generate` and `prisma migrate dev` could not actually run there. That is **not** a normal constraint; any standard dev machine, CI runner, or Netlify's own build environment can reach it fine, and `npm run db:migrate:dev` / `npm install`'s `postinstall` hook will work normally.

Rather than ship an unverified schema, the initial migration's SQL (`prisma/migrations/20260101000000_init/migration.sql`) was hand-written to match `schema.prisma` exactly and applied directly against a real local Postgres 16 instance via `psql`, then every foreign-key delete rule was queried back out of `pg_constraint` and confirmed against the design (`Restrict` on `Product→Category` and `Payment→Order`, `Cascade` on `OrderItem→Order`, `SetNull` on `OrderItem→Product`). The transaction-atomicity test (`tests/transactionAtomicity.test.ts`) also runs against that same real Postgres instance via a direct `pg` connection, independent of the generated Prisma client. The very first time you run `npm install` (which generates the client) and `npm run db:migrate:dev` in a normal environment, treat that as this schema's first real dress rehearsal with the actual Prisma engine, and skim the migration output.

## Seeding

`prisma/seed.ts` is development-only and refuses to run unless **both** hold: `NODE_ENV !== "production"` and `SEED_CONFIRM="yes-seed-dev-db"` is set in the environment. Never set `SEED_CONFIRM` in any deployed environment's configuration (Netlify env vars, etc) — that env var's absence in production is what makes the guard work, not just the `NODE_ENV` check alone.

```bash
npm run db:seed
```

Creates: one dev admin (`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`, defaults printed to the console — change immediately if this is ever exposed), the default `RestaurantSettings` singleton row, two sample categories, and two sample products.

## Creating the production admin account (Section 23)

The seed script must never touch production, so the real admin account is created once, separately, by one of:

1. **A one-time setup script** — write a small standalone script (not checked into the repo as a runnable command, to avoid it ever being run accidentally) that prompts for a real password, hashes it with `hashPassword` from `src/lib/auth/password.ts`, and inserts an `AdminUser` row via a direct, production `DIRECT_URL` connection.
2. **A manual pgAdmin insert** — generate a bcrypt hash locally (`node -e "require('bcryptjs').hash('the-real-password', 12).then(console.log)"`, matching `SALT_ROUNDS` in `src/lib/auth/password.ts`), then insert the `AdminUser` row via pgAdmin using that hash. Never type a plaintext password into a live table, and never run this against `DIRECT_URL` from a machine you don't trust.

Either way: pick a role of `SUPER_ADMIN` for the first account (so it can create/manage others later), and document who ran this and when outside the repo (a password manager entry, an internal runbook) — not in source control.

## Map tiles

The delivery-pin map (checkout + admin origin) is Leaflet, loaded
client-side only (`next/dynamic`, `ssr: false`). Tiles are fetched
**browser → tile server directly** — nothing proxies through the app, so
this adds no backend load.

The default tile server is `tile.openstreetmap.org`, which is
[explicitly not for production traffic](https://operations.osmfoundation.org/policies/tiles/)
— OSM can and does throttle or block heavy users. **Before real launch
traffic**, set `NEXT_PUBLIC_MAP_TILE_URL` / `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION`
(and `NEXT_PUBLIC_MAP_MAX_ZOOM` if the provider differs) to a keyed
provider — MapTiler, Stadia Maps, Mapbox, or a self-hosted Protomaps/TileServer.
`src/lib/mapConfig.ts` is the only place these are read; a dev-mode
console warning fires while still on the OSM default.

`NEXT_PUBLIC_MAP_DEFAULT_CENTER` / `NEXT_PUBLIC_MAP_DEFAULT_ZOOM` set the
initial view before a pin is dropped (defaults: Lagos / Ikeja).

`DELIVERY_AREA_BBOX` ("minLat,minLng,maxLat,maxLng") is a coarse
service-area box a delivery pin must fall inside — checked in
`computeCheckout` (so `/api/checkout/quote` and `/api/orders` agree)
before the origin/distance math, catching garbage coordinates and pins in
the ocean / another country. Unset → a wide Lagos-State default; `off`
disables it. Note the delivery fee is still straight-line (haversine)
distance from the origin pin, not road distance — a deliberate
"no paid distance API" tradeoff (fees can run low, and an in-radius pin
can still be practically undeliverable).

## Notifications

Order-status notifications fire from one place — `notifyOrderTransition`
in `src/lib/notifications.ts`, called by the admin status route, the bulk
status route, and `applyPaystackOutcome` (for `PAID`). Every transition
writes a durable `Notification` row (the in-app notification centre, the
header bell) and best-effort fans out to:

- **Web Push** — VAPID, no Firebase. Generate keys with
  `npx web-push generate-vapid-keys`, set `VAPID_PUBLIC_KEY` /
  `VAPID_PRIVATE_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_SUBJECT`.
  Unset → push silently disabled, the account toggle hides itself.
  `public/sw.js` is the service worker; dead subscriptions (404/410) are
  pruned on send and by the reconcile cron.
- **SMS** — for `READY`, `OUT_FOR_DELIVERY`, `CANCELLED` only (metered).
- **Email** — for `CONFIRMED`, `PREPARING`, `READY`, `DELIVERED`,
  `CANCELLED`. Needs `EMAIL_PROVIDER` wired (console fallback otherwise).

`Customer.orderUpdatesOptOut` suppresses SMS + email only. The two
tracking pages (`/account/orders/[orderNumber]`, `/order/[orderNumber]`)
also poll for the whole non-terminal lifecycle now, not just while
payment is pending — so an open tab updates itself even with push off.

`RestaurantSettings.autoConfirmPaidOrders` (default on) advances a paid
order straight to `CONFIRMED`; turn it off in the admin Settings page to
screen orders during a rush. The admin Orders list has inline "advance"
buttons and multi-select bulk advance (`PATCH /api/admin/orders/bulk-status`).

## Smart search & AI concierge

The menu search is layered (`src/lib/client/search.ts`): exact → fuzzy
(Fuse.js, client-side over `/api/menu/index`) → synonym/category
(`src/lib/menuSynonyms.ts`). Only when all three miss does the UI offer
the AI concierge (`POST /api/search/assist`).

The concierge needs `ANTHROPIC_API_KEY`. Without it the endpoint returns
`{available:false}` and the "tell us what you're craving" prompt hides —
deterministic search is unaffected. `SEARCH_ASSIST_MODEL` defaults to
`claude-opus-5`; for this high-volume, low-complexity task (gated behind
deterministic search + a 1-hour per-query cache that busts on menu edits)
`claude-haiku-4-5` is the cost-sensible choice. The route re-validates
every product id the model returns against the live DB and takes
name/price/image from the DB row — the model can never surface a
nonexistent item or a made-up price. It's rate-limited per IP.

`Product.tags` (admin-editable, seeded heuristically) feed both the
deterministic synonym layer and the concierge prompt, plus the
deterministic "Help me choose" flow. Keep them current — the concierge is
only as good as the structured menu behind it.

## Cloudinary usage monitoring

Free tier is 25 credits/month (1 credit = 1GB storage, 1GB bandwidth, or 1,000 transformations). Bandwidth from menu-page image loads is the meter that climbs fastest under real traffic, not storage — it's a soft limit with no hard cutoff, but the account gets flagged. **Check Cloudinary usage in week 2 of launch**, not just at build time — that's the point real traffic starts to show whether the free tier holds.

## Netlify

1. Connect the GitHub repo. `@netlify/plugin-nextjs` (declared in `netlify.toml`) handles the Next.js → Netlify Functions translation automatically.
2. Set every variable from `.env.example` in Netlify's environment variable configuration — **except** `SEED_CONFIRM`/`SEED_ADMIN_*`, which must never exist there. `RECONCILE_SECRET` **must** be set (the reconcile cron endpoint refuses to run without it).
3. Before relying on it in production, confirm current Netlify Function execution time and payload size limits against Netlify's own docs (Section 29) — this reviewed design keeps every handler to a small, fixed number of DB/Paystack calls specifically so it stays comfortably inside whatever that window is, but limits do change.
4. Register the webhook URL (`https://<your-domain>/api/paystack/webhook`) in the Paystack dashboard, and confirm the webhook signing behavior against Paystack's current docs (Section 14) before going live — API shapes shift.
5. `netlify/functions/reconcile-payments.mts` is a Netlify **scheduled function** (every 10 min). It needs no wiring beyond deploying — confirm it shows up under *Functions → Scheduled* after the first deploy. It calls `POST /api/internal/reconcile-payments` with the `RECONCILE_SECRET` bearer token; that endpoint re-verifies stale `PENDING` payments against Paystack, heals orders whose payment succeeded but never advanced, escalates the genuinely-stuck to `PaymentIssue` rows, and sweeps expired `RateLimit` / OTP rows. Safe to also hit by hand for an immediate pass.

## Catalog caching

The public catalog reads (`/api/products`, `/api/products/[id]`,
`/api/categories`, `/api/settings/public`) and `getSettings()` are wrapped
in `unstable_cache` (durable on Netlify via the plugin's cache handler)
and also send `CDN-Cache-Control` / `Netlify-CDN-Cache-Control` headers so
the edge absorbs repeats. Every admin write that changes what the
storefront shows calls `revalidateCatalog(...)` (`src/lib/cache.ts`), so
edits appear within one stale-while-revalidate cycle. If the menu ever
looks stale after an edit, check that the relevant admin route still calls
`revalidateCatalog`. `getSettings()` no longer does a per-request `upsert`
— the singleton row is created by the seed and the admin settings PATCH;
a missing row falls back to safe defaults (pickup on, delivery off).

## Remaining scaling work (operational, not code)

The code changes above remove the per-request DB hits on the hot paths and
add self-healing + visibility for payments. Before a genuine traffic spike
still do:

- **Neon plan**: size the pooler and disable compute autosuspend for the
  production branch; a burst of concurrent invocations can still exhaust a
  small pool. Load-test (`k6`/`autocannon`) the menu + checkout + verify
  paths against the real plan.
- **Log drain + alerts**: ship the JSON logs somewhere and alert on
  `payment_issue`, `webhook_processing_failed`, `webhook_signature_invalid`,
  and `reconcile_run_failed`. Until then the `/admin/payments` page is the
  only surface for payment anomalies.
- **Rate limiting at scale**: the DB-backed limiter adds 1–2 round trips
  per sensitive call. If that shows up under load, move it to Upstash/Redis
  (`enforceRateLimit` is the only call site to change).
- **Cloudinary**: watch bandwidth in week 2 (see below).
- **Outbound email/SMS**: currently sent inline. A provider outage delays
  the verify/webhook response and drops receipts (logged only). Queue them
  if volume grows.

## Environment variables

See `.env.example` for the full list with explanations. Never commit real values.

`SMS_PROVIDER` and `EMAIL_PROVIDER` are optional and can stay unset through development — a console fallback logs OTP codes and receipt emails to the server log instead of sending them. Both **must** be set to a real provider before production launch: with `NODE_ENV=production` and no provider configured, the first real send throws instead of silently no-opping (the same guard pattern as `SEED_CONFIRM` above). Wiring in a real provider is a one-file change — add a `case` to `getSmsProvider()` in `src/lib/sms.ts` or `getEmailProvider()` in `src/lib/email.ts`.
