# API Surface

Every response is `{ "success": true, "data": ... }` or `{ "success": false, "error": { "code", "message" } }` (Section 34). Full failure-mode reasoning lives in the architecture doc; this is the quick route reference.

**Interactive docs:** run the app (`npm run dev`) and open `/api-docs` for a Swagger UI where you can browse every route in detail and fire real requests ("Try it out") — including admin routes, by logging in right there via `POST /api/admin/auth/login`. The underlying spec is `public/openapi.json`; regenerate it with `npm run docs:build` after changing any route, request/response shape, or validation schema in `src/lib/validation.ts`.

## Public

| Route | Method | Notes |
|---|---|---|
| `/api/categories` | GET | Active categories only. |
| `/api/products` | GET | Active + available only. `?categoryId=&page=&limit=`, server-capped page size. Cached (`unstable_cache` + CDN headers); invalidated on any admin product/category write. |
| `/api/products/[id]` | GET | Single product. |
| `/api/settings/public` | GET | `pickupEnabled`, `deliveryEnabled`, `maxDeliveryDistanceKm` only — never the origin coordinates or per-km rate. |
| `/api/menu/index` | GET | Full active + available menu (id, name, description, price, image, categoryId, tags) in one payload for the client-side smart search. Cached + CDN-cacheable. |
| `/api/search/assist` | POST | `{query}`. AI concierge — Layer 4 of search, called only after deterministic matching fails. Returns `{available:false}` when `ANTHROPIC_API_KEY` is unset. Rate-limited per IP; identical queries cached ~1h (busted on menu edits). Every returned product id is re-validated against the DB. |
| `/api/checkout/quote` | POST | Preview only, creates nothing. Runs the same fulfillment/range/floor sequence as order creation. |
| `/api/orders` | POST | No login. Ownership is a per-device profile — the `device_token` httpOnly cookie, minted + set on the response the first time a device checks out. Same-origin enforced. Rate-limited by IP. Idempotent on `idempotencyKey`; a key already used by a different device is rejected. `customerEmail` is optional but is what a later online payment / saved-card reuse is keyed to. Returns `trackingSlug`. |
| `/api/orders/[slug]` | GET | Public order tracking by unguessable `trackingSlug` — the slug **is** the capability, no `?ref=`. `orderNumber` is a display label, never a lookup key. If the request carries the placing device's cookie and that device has a reusable saved card, the response includes `canPayWithSavedCard` + `savedCardLabel`. |
| `/api/history` | GET | This device's order history + one-tap-reorder feed, keyed on `device_token`. Also reports `savedCard` and whether the history is `secured` to a verified email. Unrecognised device → empty payload. |
| `/api/history/reorder` | POST | `{trackingSlug}` for one of this device's past orders → its lines re-priced against the current menu (gone/unavailable items flagged). Same-origin enforced. |
| `/api/history/secure` | POST | `{email}` → sends a passwordless email magic link ("secure your order history"). Mints a device profile if needed (so recovery works from a fresh device). Rate-limited per profile and IP. Never gates anything. |
| `/api/history/secure/confirm` | GET | Magic-link click target. Consumes the token, sets `verifiedContactEmail` on the opening device's profile, merges any other profile carrying that email (orders + saved card move over), redirects to `/history?secured=1` (or `=failed`). Not a JSON endpoint. |
| `/api/payments/initialize` | POST | `{orderId}`. The device (via `device_token`) must own the order. Email sent to Paystack is the order's `customerEmail` snapshot, falling back to the device's `verifiedContactEmail`; an order with no email at all can't pay online (`VALIDATION_ERROR`). No account-email-verified gate. Rate-limited by order and IP. See `src/lib/payments.ts` for the arm/re-arm decision table. |
| `/api/payments/charge-authorization` | POST | `{trackingSlug}`. "Pay with your last card" — charges the device's stored reusable Paystack authorization for a still-unpaid order it owns, no popup. Runs through `applyPaystackOutcome` exactly like a verify, so it's server-confirmed. Card only. |
| `/api/payments/verify` | GET | `?reference=`. Server-authoritative — never trusts the frontend popup callback alone. |
| `/api/paystack/webhook` | POST | Signature-verified (`x-paystack-signature`, HMAC-SHA512). Idempotent per reference; unknown/superseded reference is a safe 200, not an error. On the successful-payment transition, also sends a receipt email to the order's `customerEmail` (awaited, logged-and-swallowed on failure) and, for a reusable card charge, stores the Paystack `authorization_code` + its email on the placing device's profile. |

## Device identity (no-login checkout)

Checkout needs no account. A `DeviceProfile` (opaque `device_token` httpOnly cookie, 400-day TTL) owns a device's orders, an optional reusable Paystack card authorization, and an optional `verifiedContactEmail`. Confirming that email via the magic link makes the history + saved card recoverable on any other device by re-verifying the same address. Order-status updates reach device customers by SMS + email (from the order's contact snapshot); the in-app notification centre and Web Push remain account-only and are currently dormant.

The phone-OTP account routes (`/api/auth/otp/*`, `/api/auth/email/*`, `/api/auth/customer/logout`, `/api/me/*`) and the `PhoneOtp` / `EmailVerificationCode` models still exist but nothing in the storefront reaches them — slated for removal.

## Admin — every route below requires a valid session cookie; state-changing routes also check the request Origin

| Route | Method | Notes |
|---|---|---|
| `/api/admin/auth/login` | POST | IP rate-limited + per-account lockout after 5 failures (15 min). |
| `/api/admin/auth/logout` | POST | Clears the session cookie. |
| `/api/admin/auth/me` | GET | Current admin identity. |
| `/api/admin/orders` | GET | Paginated, `?status=&page=&limit=`. |
| `/api/admin/orders/[id]` | GET | Full detail (items, payment, customer info) in one call. |
| `/api/admin/orders/[id]/status` | PATCH | Explicit transition allow-list only (fulfilment-aware: delivery orders go READY→OUT_FOR_DELIVERY→DELIVERED, pickup READY→COMPLETED); conflict-safe. Fires the customer notification for that step. |
| `/api/admin/orders/bulk-status` | PATCH | `{orderIds[1..30], target?}` — advance many orders one step each (no target) or to a specific status. Per-order results; illegal/conflicting rows skipped, not fatal. Notifies each moved order. |
| `/api/admin/products` | GET, POST | List / create. |
| `/api/admin/products/[id]` | PATCH, DELETE | `DELETE` is a soft delete (`isActive=false`), never destructive. |
| `/api/admin/products/[id]/image-signature` | POST | Signed Cloudinary direct-upload credentials. |
| `/api/admin/categories` | GET, POST | List / create. |
| `/api/admin/categories/[id]` | PATCH | No DELETE — deactivate via `{isActive:false}` instead (Restrict FK from Product). |
| `/api/admin/settings` | GET, PATCH | Delivery rate/floor/range, origin coordinates, pickup/delivery toggles. `GET` reads fresh (not the cached storefront copy); `PATCH` invalidates the catalog cache. |
| `/api/admin/payments` | GET | Payment anomalies (`PaymentIssue`): amount mismatches, orphan charges, stuck-pending, paid-but-not-advanced. `?status=OPEN\|RESOLVED\|IGNORED&page=&limit=`, defaults to `OPEN`. Always returns `openCount`. |
| `/api/admin/payments/[id]` | PATCH | `{status: "RESOLVED" \| "IGNORED"}` — close an issue a human has dealt with. One-way; the system re-opens it if the anomaly recurs. |

## Internal

| Route | Method | Notes |
|---|---|---|
| `/api/internal/reconcile-payments` | GET, POST | Not part of the public/customer/admin surface. `Authorization: Bearer $RECONCILE_SECRET`. Re-verifies stale `PENDING` payments against Paystack and applies missed outcomes, heals paid-but-unadvanced orders, escalates the genuinely-stuck to `PaymentIssue`, and sweeps expired `RateLimit`/OTP rows. Called every ~10 min by `netlify/functions/reconcile-payments.mts`; safe to invoke by hand. |
