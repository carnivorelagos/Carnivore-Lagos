# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are **repeat regulars of a single restaurant** — a known local
customer base in Lagos, Nigeria who reorder favorites for pickup or delivery.
They order from a phone, expect a fast path from menu to payment, and value
their account and order history (reordering, tracking a live order, checking
what they got last time). Payment is in Nigerian Naira via Paystack; identity
is a phone number verified by SMS OTP.

Secondary users are **restaurant staff / owner** working the admin dashboard:
running the live order queue, advancing order status, managing the menu
(products, categories, availability, photos), and setting delivery rate,
minimum fee, range, and pickup/delivery toggles.

## Product Purpose

Give one independent restaurant its own branded online ordering channel —
menu browsing, accounts-only checkout, server-verified card payment, and an
order lifecycle staff can drive — without depending on a third-party
marketplace or aggregator. Success is a regular completing a paid order in
under a couple of minutes and the kitchen seeing it immediately, with no
disputed or mis-priced orders.

## Positioning

A single-restaurant ordering system where **server-side integrity is the
product**: totals, delivery fees, and product availability are always
recomputed on the backend and never trusted from the client; payment is
verified server-authoritatively and reconciled a second independent way by
Paystack webhook; order-creation is idempotent under double-submit and true
concurrent races; order status moves only along an explicit transition
allow-list. It is the restaurant's own storefront, not a listing inside an
aggregator, so the brand and the customer relationship stay with the
restaurant.

## Operating Context

- **Customer ordering site (web, mobile-first):** browse active categories and
  available products → build a cart → sign in with phone + SMS OTP (same flow
  for new and returning; the backend never reveals whether a number is already
  registered) → verify an email once (gates payment only, not browsing or
  login) → choose pickup or delivery → see a server-computed quote → place the
  order → pay via Paystack Inline → track status via order number + payment
  reference, or from account order history.
- **Admin dashboard (web):** password login with per-account lockout →
  paginated order list filterable by status → order detail (items, payment,
  customer) → status transition (allow-list, conflict-safe) → product and
  category CRUD with soft-delete/deactivate only → signed direct-to-Cloudinary
  image upload → restaurant settings (delivery rate/floor/range in kobo,
  origin coordinates, pickup/delivery enabled).
- **Developer surface:** `/api-docs` Swagger UI over `public/openapi.json`,
  same-origin so admin routes can be exercised with a real session cookie.
- Money is integer **kobo** end to end (1 Naira = 100 kobo); never floats.
- Order statuses: `PENDING_PAYMENT → PAID → CONFIRMED → PREPARING → READY →
  COMPLETED`, plus `CANCELLED`.
- Delivery fee = `max(ceil(distanceKm × ratePerKmKobo), minDeliveryFeeKobo)`;
  origin coordinates and per-km rate are never exposed on the public settings
  endpoint.

## Capabilities and Constraints

- **Stack (fixed, do not change):** Next.js 16 App Router Route Handlers (no
  separate server), Prisma 7 over `@prisma/adapter-neon` (Neon serverless
  driver, pooled `DATABASE_URL`), Neon Postgres, Paystack Inline, Cloudinary
  signed direct uploads, `jose` sessions, bcrypt password hashing, Zod
  validation. No Redis — rate limiting is a DB-backed fixed-window counter.
  Deployed on Netlify via `@netlify/plugin-nextjs`.
- Every API response is `{ success: true, data }` or
  `{ success: false, error: { code, message } }`.
- **Accounts-only checkout:** an order cannot be created without a signed-in
  `customer_session`; browsing stays public.
- Auth is **phone-OTP only** — no passwords for customers. Email is collected
  once at signup and verified once; it gates `POST /api/payments/initialize`
  only.
- Product delete is soft (`isActive = false`); categories deactivate rather
  than delete (Restrict FK from Product).
- Rate-limited surfaces with real cost: OTP request (5/phone, 15/IP per
  window), payment initialize (per order + per IP), order create (per IP),
  admin login (per IP + per-account lockout, 5 fails → 15 min).
- Single restaurant only — `RestaurantSettings` is a singleton row
  (`id = "default"`). No multi-location, no marketplace of restaurants.
- Cloudinary free tier (25 credits/mo); menu-image bandwidth is the fastest-
  climbing meter — image treatment on the customer site should be mindful of
  transformation/bandwidth cost.
- **Not yet built:** any customer-facing UI beyond a placeholder page, and any
  admin UI. The `/` route and `src/app/page.module.css` are unmodified
  create-next-app scaffold and carry no design intent.

## Brand Commitments

A real, specific restaurant exists and will own this storefront. Its name,
logo, menu content, and photography are **assets the user will provide** —
they are not in the repo yet (`prisma/seed.ts` uses a throwaway "Sample
Restaurant" / Lagos coordinates for dev only, which is not the real brand).
Design must be built to receive a real single-restaurant identity: one
wordmark/logo, real menu categories and dish photos, real Naira prices.
No brand name, voice, color, or type direction is confirmed yet — those are
open and belong to later visual work, not to this record.

## Evidence on Hand

- `API.md` — full route surface and per-route behavior.
- `DEPLOYMENT.md` — connection architecture, migration provenance, production
  admin creation, Cloudinary monitoring.
- `docs/customer-accounts-addendum.html` — rationale for the phone-OTP
  signup/login + one-time email verification flow.
- `public/openapi.json` + `/api-docs` — interactive spec.
- `prisma/schema.prisma` — 11 models; enums for order/payment status and
  fulfillment type.
- Test suite documents the guaranteed behaviors (total calculation,
  transition allow-list, webhook signature verification, price-tampering
  resistance, order idempotency under concurrency, admin lockout).
- **No real menu data, dish photography, customer testimonials, order volume,
  or the restaurant's name/branding are on hand.** Future work must not
  fabricate any of these.

## Product Principles

1. **The server is the source of truth.** Prices, totals, delivery fees,
   availability, and payment outcome are always recomputed/verified on the
   backend; the client is never trusted. UI must reflect this — show the
   server quote, never a client-guessed total, at the moment of commitment.
2. **The restaurant owns the relationship.** This is the restaurant's own
   branded channel, not a slot in an aggregator. The customer's sense of who
   they are ordering from is the restaurant, start to finish.
3. **Fast for people who already know what they want.** Regulars reordering
   favorites are the core case: minimize steps from open to paid, make
   reorder and order history first-class.
4. **Honest, low-cost friction.** Phone-OTP and one-time email verification
   exist for real reasons (SMS cost, payment integrity); surface them as
   quick and legible, never as bureaucratic gates, and never leak whether an
   account exists.
5. **Degrade safely.** Rate limits, lockouts, pending payments, and
   conflicting admin edits are expected states — every one needs a calm,
   specific UI treatment, not a generic error.

## Accessibility & Inclusion

No formal standard has been mandated. Given a mobile-first Nigerian consumer
audience on varied devices and networks: design for small screens and touch
first, keep image payloads light, and ensure the full order path works
without hover and at reasonable contrast. Revisit for a specific WCAG target
if the restaurant requires one.
