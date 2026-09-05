# Carnivore Lagos — Frontend

Customer storefront + staff admin built on top of the existing API. No
backend route, `src/lib/**` backend module, or `prisma/**` file was
modified. The only root-config change is `next.config.ts` (image
`remotePatterns` for Cloudinary + placeholder photo hosts).

## Run it

```bash
npm install                       # already includes the frontend deps
# .env — set this for local dev or every mutation 403s (CSRF Origin check):
#   NEXT_PUBLIC_APP_URL="http://localhost:3000"
npm run db:migrate:deploy         # the customer_accounts migration is still pending
npm run db:seed                   # loads the real 8-category / 60-product menu
npm run dev
```

Storefront at `/`, admin at `/admin` (first admin account: see
`DEPLOYMENT.md` → "Creating the production admin account", or `npm run
db:seed` in dev).

## What needs live services for full QA

| Blocker | Effect until resolved | Fix |
|---|---|---|
| `20260828110329_customer_accounts` migration not applied | `Customer`/`Order`/`Payment` tables missing → auth, checkout, account, admin-order pages error | `npm run db:migrate:deploy` |
| `NEXT_PUBLIC_APP_URL` = placeholder | **Every** POST/PATCH/DELETE returns 403 FORBIDDEN | set it to the real browser origin |
| `CLOUDINARY_*` empty | Admin product image upload fails (`image-signature` 500) | real Cloudinary creds |
| `PAYSTACK_PUBLIC_KEY` placeholder / secret key validity | `payments/initialize` fails at Paystack | real Paystack test keys |
| No SMS/email provider | OTP + email codes only print to server logs (dev console provider) | set `SMS_PROVIDER` / `EMAIL_PROVIDER` |

Build, typecheck and lint pass with none of the above
(`npm run build`).

## Architecture

```
src/
  app/
    layout.tsx                 root: fonts (Fraunces/Inter/JetBrains), <ToastProvider>
    globals.css                Tailwind v4 + dual-theme token system
    not-found.tsx
    (store)/                   customer surface — committed dark theme
      layout.tsx               AuthProvider > CartProvider > CartSheetProvider + chrome
      error.tsx
      page.tsx                 /            home
      menu/ · product/[id]/ · cart/ · login/ · checkout/
      order/[orderNumber]/     public tracking (?ref=)
      account/ · account/orders/ · account/orders/[orderNumber]/
    admin/                     staff surface — committed light theme (.admin scope)
      layout.tsx               .admin token scope + AdminAuthProvider + AdminShell
      login/ · page.tsx (overview) · orders/ · orders/[id]/
      products/ · products/new/ · products/[id]/edit/
      categories/ · settings/
  components/
    providers/   ToastProvider, AuthProvider, CartProvider, AdminAuthProvider
    ui/          Button, form fields, Badge/OrderStatusBadge/PaymentStatusBadge,
                 Money, QuantityStepper, OtpInput, Overlay (Sheet+Dialog),
                 feedback (Spinner/Skeleton/EmptyState/ErrorState/PageState)
    store/       StoreHeader, BottomNav, StoreFooter, Wordmark, CartSheet,
                 ProductCard, CategoryNav, ProductGridSkeleton, FeaturedGrill,
                 OrderTimeline, OrderLineItems, RequireAuth
    admin/       AdminShell, primitives (PageHeader/Card/TableWrap/…),
                 Toggle, ProductForm, ImageUploader, useAdminData
    map/         DeliveryMap (Leaflet, ssr:false), DeliveryMapField
  lib/client/    api (ApiError + apiFetch + apiRead), endpoints (every route),
                 types, errors (§39 copy map + field errors), format (kobo/date/
                 phone + status labels), paystack (Inline v2), usePayOrder,
                 useAsyncData, checkoutSession (idempotency), cn, brand
  types/         paystack-inline-js.d.ts
```

### Key decisions

- **All data fetching is client-side** through `apiFetch` (browser only).
  The backend's CSRF layer checks the `Origin` header on every mutation,
  and only a real browser fetch sends it, so no Server Component / Server
  Action ever calls the API. Reads get the same treatment for
  consistency; every data view has skeleton + error + empty states.
- **Two token sets, one Tailwind build.** Semantic tokens (`--color-bg`,
  `--color-surface`, `--color-accent`, …) are defined for the storefront
  on `:root` and re-declared for admin under a `.admin` scope class set
  by the admin layout. Every component uses the semantic names.
- **Money is integer kobo end to end.** Naira only appears via
  `Intl.NumberFormat` for display and is parsed back to kobo before any
  request (`nairaInputToKobo`).
- **Auth**: HTTP-only cookies, never touched by JS. `AuthContext` hydrates
  from `GET /api/me`; a 401 is "signed out", not an error. `logout()`
  always calls `POST /api/auth/customer/logout` before clearing state.
- **Cart**: `CartContext` + `localStorage` key `carnivore_cart`, capped at
  50/line and 30 lines (matches `validation.ts`), cross-tab synced. Cart
  price is a display snapshot only; the server quote/total is
  authoritative at checkout.
- **Checkout idempotency**: one UUID per attempt in `sessionStorage`,
  bound to a hash of cart + fulfillment + pin. A refresh mid-flow reuses
  it; changing the order mints a fresh key.
- **Payments**: `initialize` → Paystack Inline v2 `resumeTransaction(accessCode)`
  (no public key client-side) → `GET /api/payments/verify` is the
  authority. `amountMismatch` never shows success. `PAYMENT_VERIFICATION_FAILED`
  / `PAYMENT_PROVIDER_UNAVAILABLE` handled at both the initialize and
  verify call sites.
- **Admin order transitions** mirror `orderStateMachine.ts` client-side to
  pick which buttons to show; the backend still enforces. `CONFLICT`
  refetches and tells the admin the current state.

## Placeholder assets to replace before launch

Photography is seeded Picsum (allow-listed in `next.config.ts`). Replace
the `src` values in `src/lib/client/brand.ts` → `PLACEHOLDER_IMAGES` with
real Cloudinary food photography:

- `hero` — hands turning suya skewers over open flame, ≥1600×1400
- `menuHero` — spread of dishes on a dark table, ≥1600×900
- `storyGrill` — the charcoal grill, close and hot, ≥1200×1500

Also in `brand.ts`: `addressLine`, `phoneDisplay`, `hours`, `instagram`
are placeholders — confirm with the restaurant. There is no logo asset;
`Wordmark.tsx` is a text wordmark to be swapped when one exists.

## Packages added

`tailwindcss` + `@tailwindcss/postcss` (v4), `leaflet` + `react-leaflet`
(v5) + `@types/leaflet`, `@paystack/inline-js` (v2), `@phosphor-icons/react`,
`clsx`.

## Manual QA checklist (once the blockers above are cleared)

Customer: browse menu signed out · category filter · product detail ·
add/remove/qty in cart · empty cart · login (new + returning) · invalid /
expired OTP · checkout redirect when signed out · pickup checkout ·
delivery checkout with map pin · out-of-range address · unavailable
product surfaced on the affected line · live quote refresh · order
creation · refresh mid-checkout (same order returned) · payment popup ·
payment cancel → retry · successful payment → verify → tracking page ·
tracking page signed out with ?ref= · account profile · email
verification · order history + detail · logout.

Admin: login · wrong credentials · locked account · session expiry
redirect · orders table + status filter + pagination · order detail ·
each valid transition · invalid transition blocked · concurrent-edit
CONFLICT · products incl. inactive · create → edit → image upload ·
deactivate (soft) · categories create/edit (no delete) · settings incl.
zero-pricing and no-origin warnings · logout.
