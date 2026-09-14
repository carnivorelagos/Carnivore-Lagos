import { z } from "zod";

/**
 * Every external input boundary — request bodies, query params, route
 * params — is validated with one of these schemas before touching any
 * business logic (Section 26). Frontend validation is UX only.
 */

// UUID-*shape* check, not RFC-version-strict. Zod 4's `z.uuid()` enforces
// the version nibble (1-8), which rejects perfectly valid opaque ids we
// use elsewhere — e.g. the seed's fixed product ids
// (`00000000-0000-0000-0000-0000000001xx`). Every id we validate here is
// one we generated and look up by exact match; the shape is all that
// matters. `z.guid()` is that looser check.
export const uuidSchema = z.guid();

/**
 * Nigerian phone numbers, accommodated without being unnecessarily
 * restrictive (Section 11): accepts `+234XXXXXXXXXX` (10 digits after the
 * country code) or a local `0XXXXXXXXXX` (11 digits). Spaces/dashes are
 * stripped before validating so "0801 234 5678" and "0801-234-5678" both
 * pass.
 */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^(?:\+234\d{10}|0\d{10})$/, "Enter a valid Nigerian phone number."));

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  // Server-capped regardless of what the client asks for (Section 39).
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const MAX_QUANTITY_PER_ITEM = 50;
const MAX_DISTINCT_ITEMS = 30;
const MAX_NOTES_LENGTH = 500;
const MAX_NAME_LENGTH = 120;
const MAX_ADDRESS_LENGTH = 300;

export const cartItemSchema = z.object({
  productId: uuidSchema,
  quantity: z.coerce.number().int().min(1).max(MAX_QUANTITY_PER_ITEM),
});

export const cartItemsSchema = z.array(cartItemSchema).min(1).max(MAX_DISTINCT_ITEMS);

export const latLngSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

/**
 * Shared by /api/checkout/quote and POST /api/orders — both run the exact
 * same shape of request through the exact same fulfillment/range/floor
 * sequence (see checkout.ts).
 */
export const checkoutBaseSchema = z
  .object({
    fulfillmentType: z.enum(["PICKUP", "DELIVERY"]),
    items: cartItemsSchema,
    customerName: z.string().trim().min(1).max(MAX_NAME_LENGTH),
    customerPhone: phoneSchema,
    customerEmail: z.email().max(200).optional(),
    deliveryAddress: z.string().trim().max(MAX_ADDRESS_LENGTH).optional(),
    deliveryPin: latLngSchema.optional(),
    notes: z.string().trim().max(MAX_NOTES_LENGTH).optional(),
  })
  .refine(
    (v) => v.fulfillmentType !== "DELIVERY" || v.deliveryPin !== undefined,
    { message: "A delivery pin (lat/lng) is required for delivery orders.", path: ["deliveryPin"] },
  );

export const checkoutQuoteSchema = checkoutBaseSchema;

export const createOrderSchema = checkoutBaseSchema.and(
  z.object({
    idempotencyKey: z.uuid(),
  }),
);

export const orderLookupQuerySchema = z.object({
  ref: z.string().min(1).max(200),
});

export const paymentsInitializeSchema = z.object({
  orderId: uuidSchema,
});

export const paymentsVerifyQuerySchema = z.object({
  reference: z.string().min(1).max(200),
});

// --- Admin ---------------------------------------------------------------

export const adminLoginSchema = z.object({
  email: z.email().max(200),
  password: z.string().min(1).max(200),
});

export const adminProductCreateSchema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  description: z.string().trim().max(2000).optional(),
  priceKobo: z.number().int().min(1),
  categoryId: uuidSchema,
  imageUrl: z.url().optional(),
  imagePublicId: z.string().max(300).optional(),
  isActive: z.boolean().default(true),
  isAvailable: z.boolean().default(true),
  // Lowercased, de-duped, capped — attribute tags for search / concierge.
  tags: z
    .array(z.string().trim().toLowerCase().min(1).max(30))
    .max(20)
    .transform((arr) => Array.from(new Set(arr)))
    .optional(),
});

export const adminProductUpdateSchema = adminProductCreateSchema.partial();

export const adminCategoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const adminCategoryUpdateSchema = adminCategoryCreateSchema.partial();

export const adminSettingsUpdateSchema = z.object({
  restaurantName: z.string().trim().min(1).max(MAX_NAME_LENGTH).optional(),
  originLat: z.number().min(-90).max(90).nullable().optional(),
  originLng: z.number().min(-180).max(180).nullable().optional(),
  deliveryRatePerKmKobo: z.number().int().min(0).optional(),
  minDeliveryFeeKobo: z.number().int().min(0).optional(),
  maxDeliveryDistanceKm: z.number().min(0).nullable().optional(),
  pickupEnabled: z.boolean().optional(),
  deliveryEnabled: z.boolean().optional(),
  autoConfirmPaidOrders: z.boolean().optional(),
});

export const ORDER_STATUS_VALUES = [
  "PENDING_PAYMENT",
  "PAID",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
] as const;

export const adminOrderStatusUpdateSchema = z.object({
  status: z.enum(ORDER_STATUS_VALUES),
});

export const adminBulkStatusSchema = z.object({
  orderIds: z.array(uuidSchema).min(1).max(30),
  // Omit to "advance each order one step" (fulfilment-aware); provide an
  // explicit target to move them all to the same status.
  target: z.enum(ORDER_STATUS_VALUES).optional(),
});

export const adminOrderListQuerySchema = paginationSchema.extend({
  status: z.enum(ORDER_STATUS_VALUES).optional(),
});

export const PAYMENT_ISSUE_STATUS_VALUES = ["OPEN", "RESOLVED", "IGNORED"] as const;

export const adminPaymentIssueListQuerySchema = paginationSchema.extend({
  status: z.enum(PAYMENT_ISSUE_STATUS_VALUES).optional(),
});

export const adminPaymentIssueUpdateSchema = z.object({
  // A human can only close an issue, never re-open one by hand — the
  // system re-opens it automatically if the same anomaly recurs.
  status: z.enum(["RESOLVED", "IGNORED"]),
});

export const imageSignatureRequestSchema = z.object({
  // Cloudinary folder the upload will land in — constrained to a fixed
  // value server-side rather than trusted from the client, but accepted
  // here so the route can validate it against an allow-list.
  folder: z.string().max(100).default("products"),
});

// --- Customer accounts -----------------------------------------------------

export const otpCodeSchema = z.string().regex(/^\d{6}$/, "Enter the 6-digit code.");

export const phoneOtpRequestSchema = z.object({
  phone: phoneSchema,
});

export const phoneOtpVerifySchema = z.object({
  phone: phoneSchema,
  code: otpCodeSchema,
});

export const emailVerificationRequestSchema = z.object({
  email: z.email().max(200),
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH).optional(),
});

export const emailVerificationConfirmSchema = z.object({
  code: otpCodeSchema,
});

// --- Device history / no-login (amendments 2-4) -----------------------

/** An order tracking slug (cuid ~24 chars) or device token (base64url). */
export const trackingSlugSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{16,64}$/, "Invalid order reference.");

export const reorderSchema = z.object({ trackingSlug: trackingSlugSchema });

export const chargeSavedCardSchema = z.object({ trackingSlug: trackingSlugSchema });

export const secureHistorySchema = z.object({
  email: z.email().max(200),
});
