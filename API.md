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
| `/api/orders` | POST | Requires a signed-in customer (`customer_session` cookie) — checkout is accounts-only, browsing stays public. Rate-limited by IP. Idempotent on `idempotencyKey`; reusing another customer's key is rejected rather than returning their order. |
| `/api/orders/[orderNumber]` | GET | Requires `?ref=` (the Payment reference) as a second factor. |
| `/api/payments/initialize` | POST | `{orderId}`. Requires the signed-in customer to own the order and their account email to be verified (`EMAIL_NOT_VERIFIED`, 403, otherwise). Sends Paystack the account's own verified email, never the order's editable `customerEmail` snapshot. Rate-limited by order and by IP. See `src/lib/payments.ts` for the arm/re-arm decision table. |
| `/api/payments/verify` | GET | `?reference=`. Server-authoritative — never trusts the frontend popup callback alone. |
| `/api/paystack/webhook` | POST | Signature-verified (`x-paystack-signature`, HMAC-SHA512). Idempotent per reference; unknown/superseded reference is a safe 200, not an error. On the successful-payment transition, also sends a receipt email to the order's `customerEmail` (awaited, logged-and-swallowed on failure — never turns a successful payment into an API error). |

## Customer Accounts — phone-OTP signup/login; `/api/me/*` requires the `customer_session` cookie

Accounts-only checkout: an order cannot be created without a signed-in customer. Signup and login are the same flow — one endpoint, the backend decides new-vs-returning and never reveals whether a phone number is already registered. Email is collected and verified once, at signup, and gates only the payment step (`POST /api/payments/initialize`), never login or browsing. See `docs/customer-accounts-addendum.html` for the full flow rationale.

| Route | Method | Notes |
|---|---|---|
| `/api/auth/otp/request` | POST | `{phone}`. Texts a 6-digit code either way (signup or login). Rate-limited by phone (5/window) and IP (15/window) — abuse here has a direct SMS cost. |
| `/api/auth/otp/verify` | POST | `{phone, code}`. Creates the `Customer` on first-ever verification for that phone, otherwise logs in. Sets the `customer_session` cookie (30-day TTL). Rate-limited by IP. |
| `/api/auth/customer/logout` | POST | Clears the `customer_session` cookie. |
| `/api/auth/email/request` | POST | Requires `customer_session`. `{email, name?}`. Saves the email (unverified) and optional display name, sends a verification code. Rate-limited per customer. |
| `/api/auth/email/confirm` | POST | Requires `customer_session`. `{code}`. Sets `Customer.emailVerifiedAt` on success. |
| `/api/me` | GET | Requires `customer_session`. Current customer profile. |
| `/api/me/orders` | GET | Requires `customer_session`. Paginated order history for the signed-in customer only, `?page=&limit=`. |
| `/api/me/orders/[orderNumber]` | GET | Requires `customer_session`. Full order detail — 404 (not 403) whether the order doesn't exist or simply isn't this customer's. |
| `/api/me` | GET, PATCH | `GET` current profile. `PATCH {orderUpdatesOptOut?}` — opt in/out of SMS + email order updates (in-app + push unaffected). |
| `/api/me/notifications` | GET, PATCH | `GET` paginated in-app notifications + `unreadCount` (`?unread=1` for unread only). `PATCH` marks all read. |
| `/api/me/notifications/[id]` | PATCH | Mark one notification read. 404 if not this customer's. |
| `/api/me/push/subscribe` | POST, DELETE | Register / remove a Web Push subscription (`{subscription}` / `{endpoint}`). No-op server-side when VAPID isn't configured. |

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
