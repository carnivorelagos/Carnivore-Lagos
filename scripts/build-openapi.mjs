// One-off generator for public/openapi.json. Not part of the app's runtime
// — run it manually whenever the API surface changes, then delete this
// script's output is what ships (public/openapi.json), not this file.
import { writeFileSync } from "node:fs";

const envelopeOk = (dataSchema) => ({
  type: "object",
  properties: { success: { type: "boolean", enum: [true] }, data: dataSchema },
  required: ["success", "data"],
});

const envelopeError = {
  type: "object",
  properties: {
    success: { type: "boolean", enum: [false] },
    error: {
      type: "object",
      properties: {
        code: { type: "string", example: "VALIDATION_ERROR" },
        message: { type: "string" },
        details: {},
      },
      required: ["code", "message"],
    },
  },
  required: ["success", "error"],
};

const errorResponse = (desc) => ({
  description: desc,
  content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
});

const okResponse = (desc, schemaName, status = 200) => ({
  [status]: {
    description: desc,
    content: { "application/json": { schema: { $ref: `#/components/schemas/${schemaName}Envelope` } } },
  },
});

const money = { type: "integer", description: "Integer kobo (₦1 = 100 kobo)." };
const uuid = { type: "string", format: "uuid" };
const dateTime = { type: "string", format: "date-time" };

const schemas = {
  ErrorEnvelope: envelopeError,

  Category: {
    type: "object",
    properties: {
      id: uuid,
      name: { type: "string" },
      isActive: { type: "boolean" },
      sortOrder: { type: "integer" },
      createdAt: dateTime,
      updatedAt: dateTime,
    },
  },
  CategoryListEnvelope: envelopeOk({ type: "array", items: { $ref: "#/components/schemas/Category" } }),
  CategoryEnvelope: envelopeOk({ $ref: "#/components/schemas/Category" }),

  Product: {
    type: "object",
    properties: {
      id: uuid,
      name: { type: "string" },
      description: { type: "string", nullable: true },
      priceKobo: money,
      categoryId: uuid,
      imageUrl: { type: "string", nullable: true },
      isActive: { type: "boolean" },
      isAvailable: { type: "boolean" },
      createdAt: dateTime,
      updatedAt: dateTime,
    },
  },
  ProductEnvelope: envelopeOk({ $ref: "#/components/schemas/Product" }),
  ProductPage: {
    type: "object",
    properties: {
      items: { type: "array", items: { $ref: "#/components/schemas/Product" } },
      page: { type: "integer" },
      limit: { type: "integer" },
      total: { type: "integer" },
    },
  },
  ProductPageEnvelope: envelopeOk({ $ref: "#/components/schemas/ProductPage" }),

  PublicSettings: {
    type: "object",
    properties: {
      pickupEnabled: { type: "boolean" },
      deliveryEnabled: { type: "boolean" },
      maxDeliveryDistanceKm: { type: "number", nullable: true },
    },
  },
  PublicSettingsEnvelope: envelopeOk({ $ref: "#/components/schemas/PublicSettings" }),

  RestaurantSettings: {
    type: "object",
    properties: {
      id: { type: "string" },
      restaurantName: { type: "string" },
      originLat: { type: "number", nullable: true },
      originLng: { type: "number", nullable: true },
      deliveryRatePerKmKobo: { ...money, description: "Per-km delivery rate, in kobo." },
      minDeliveryFeeKobo: { ...money, description: "Floor applied to the computed delivery fee." },
      maxDeliveryDistanceKm: { type: "number", nullable: true },
      pickupEnabled: { type: "boolean" },
      deliveryEnabled: { type: "boolean" },
      updatedAt: dateTime,
      createdAt: dateTime,
    },
  },
  SettingsEnvelope: envelopeOk({ $ref: "#/components/schemas/RestaurantSettings" }),

  LatLng: {
    type: "object",
    required: ["lat", "lng"],
    properties: { lat: { type: "number", minimum: -90, maximum: 90 }, lng: { type: "number", minimum: -180, maximum: 180 } },
  },
  CartItem: {
    type: "object",
    required: ["productId", "quantity"],
    properties: { productId: uuid, quantity: { type: "integer", minimum: 1, maximum: 50 } },
  },
  CheckoutBase: {
    type: "object",
    required: ["fulfillmentType", "items", "customerName", "customerPhone"],
    properties: {
      fulfillmentType: { type: "string", enum: ["PICKUP", "DELIVERY"] },
      items: { type: "array", items: { $ref: "#/components/schemas/CartItem" }, minItems: 1, maxItems: 30 },
      customerName: { type: "string", maxLength: 120 },
      customerPhone: { type: "string", example: "08012345678", description: "Nigerian format: +234XXXXXXXXXX or 0XXXXXXXXXX." },
      customerEmail: { type: "string", format: "email", description: "Required before /api/payments/initialize can be called." },
      deliveryAddress: { type: "string", maxLength: 300 },
      deliveryPin: { allOf: [{ $ref: "#/components/schemas/LatLng" }], description: "Required when fulfillmentType is DELIVERY." },
      notes: { type: "string", maxLength: 500 },
    },
  },
  CheckoutQuoteRequest: { $ref: "#/components/schemas/CheckoutBase" },
  CreateOrderRequest: {
    allOf: [
      { $ref: "#/components/schemas/CheckoutBase" },
      { type: "object", required: ["idempotencyKey"], properties: { idempotencyKey: { type: "string", format: "uuid", description: "Client-generated once per checkout attempt; resend the same value on retry." } } },
    ],
  },
  CheckoutQuoteResult: {
    type: "object",
    properties: {
      subtotalKobo: money,
      deliveryFeeKobo: money,
      totalKobo: money,
      deliveryDistanceKm: { type: "number", nullable: true },
      lineItems: {
        type: "array",
        items: {
          type: "object",
          properties: {
            productId: uuid,
            productName: { type: "string" },
            unitPriceKobo: money,
            quantity: { type: "integer" },
            lineTotalKobo: money,
          },
        },
      },
    },
  },
  CheckoutQuoteEnvelope: envelopeOk({ $ref: "#/components/schemas/CheckoutQuoteResult" }),

  OrderItem: {
    type: "object",
    properties: {
      productId: { ...uuid, nullable: true },
      productNameSnapshot: { type: "string" },
      unitPriceKobo: money,
      quantity: { type: "integer" },
      lineTotalKobo: money,
    },
  },
  Order: {
    type: "object",
    properties: {
      id: uuid,
      orderNumber: { type: "string", example: "ORD-20260828-7K9M2P" },
      status: { $ref: "#/components/schemas/OrderStatus" },
      fulfillmentType: { type: "string", enum: ["PICKUP", "DELIVERY"] },
      subtotalKobo: money,
      deliveryFeeKobo: money,
      totalKobo: money,
      deliveryDistanceKm: { type: "number", nullable: true },
      createdAt: dateTime,
      items: { type: "array", items: { $ref: "#/components/schemas/OrderItem" } },
    },
  },
  OrderEnvelope: envelopeOk({ $ref: "#/components/schemas/Order" }),
  OrderStatus: { type: "string", enum: ["PENDING_PAYMENT", "PAID", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED"] },

  OrderLookupResult: {
    type: "object",
    properties: {
      id: uuid,
      orderNumber: { type: "string" },
      status: { $ref: "#/components/schemas/OrderStatus" },
      fulfillmentType: { type: "string", enum: ["PICKUP", "DELIVERY"] },
      subtotalKobo: money,
      deliveryFeeKobo: money,
      totalKobo: money,
      createdAt: dateTime,
      items: { type: "array", items: { $ref: "#/components/schemas/OrderItem" } },
      payment: {
        type: "object",
        nullable: true,
        properties: { reference: { type: "string" }, status: { type: "string", enum: ["PENDING", "SUCCESS", "FAILED"] }, paidAt: { ...dateTime, nullable: true } },
      },
    },
  },
  OrderLookupEnvelope: envelopeOk({ $ref: "#/components/schemas/OrderLookupResult" }),

  PaymentInitializeResult: { type: "object", properties: { reference: { type: "string" }, accessCode: { type: "string" } } },
  PaymentInitializeEnvelope: envelopeOk({ $ref: "#/components/schemas/PaymentInitializeResult" }),
  PaymentVerifyResult: {
    type: "object",
    properties: {
      orderStatus: { $ref: "#/components/schemas/OrderStatus" },
      paymentStatus: { type: "string", enum: ["PENDING", "SUCCESS", "FAILED"] },
      amountMismatch: { type: "boolean" },
    },
  },
  PaymentVerifyEnvelope: envelopeOk({ $ref: "#/components/schemas/PaymentVerifyResult" }),

  AdminIdentity: {
    type: "object",
    properties: { id: uuid, email: { type: "string" }, role: { type: "string", enum: ["ADMIN", "SUPER_ADMIN"] } },
  },
  AdminIdentityEnvelope: envelopeOk({ $ref: "#/components/schemas/AdminIdentity" }),
  AdminLoginRequest: {
    type: "object",
    required: ["email", "password"],
    properties: { email: { type: "string", format: "email" }, password: { type: "string" } },
  },
  AdminLogoutEnvelope: envelopeOk({ type: "object", properties: { loggedOut: { type: "boolean" } } }),

  AdminOrderSummary: {
    type: "object",
    properties: {
      id: uuid,
      orderNumber: { type: "string" },
      status: { $ref: "#/components/schemas/OrderStatus" },
      fulfillmentType: { type: "string", enum: ["PICKUP", "DELIVERY"] },
      customerName: { type: "string" },
      totalKobo: money,
      createdAt: dateTime,
      payment: { type: "object", nullable: true, properties: { status: { type: "string", enum: ["PENDING", "SUCCESS", "FAILED"] } } },
    },
  },
  AdminOrderPage: {
    type: "object",
    properties: { items: { type: "array", items: { $ref: "#/components/schemas/AdminOrderSummary" } }, page: { type: "integer" }, limit: { type: "integer" }, total: { type: "integer" } },
  },
  AdminOrderPageEnvelope: envelopeOk({ $ref: "#/components/schemas/AdminOrderPage" }),
  AdminOrderDetailEnvelope: envelopeOk({
    allOf: [
      { $ref: "#/components/schemas/Order" },
      { type: "object", properties: { customerName: { type: "string" }, customerPhone: { type: "string" }, customerEmail: { type: "string", nullable: true }, deliveryAddress: { type: "string", nullable: true }, notes: { type: "string", nullable: true }, payment: { type: "object", nullable: true } } },
    ],
  }),
  AdminOrderStatusUpdateRequest: { type: "object", required: ["status"], properties: { status: { $ref: "#/components/schemas/OrderStatus" } } },

  AdminProductCreateRequest: {
    type: "object",
    required: ["name", "priceKobo", "categoryId"],
    properties: {
      name: { type: "string", maxLength: 120 },
      description: { type: "string", maxLength: 2000 },
      priceKobo: { ...money, minimum: 1 },
      categoryId: uuid,
      imageUrl: { type: "string", format: "uri" },
      imagePublicId: { type: "string", maxLength: 300 },
      isActive: { type: "boolean", default: true },
      isAvailable: { type: "boolean", default: true },
    },
  },
  AdminProductUpdateRequest: { allOf: [{ $ref: "#/components/schemas/AdminProductCreateRequest" }], description: "All fields optional (partial update)." },
  AdminProductPage: { type: "object", properties: { items: { type: "array", items: { $ref: "#/components/schemas/Product" } }, page: { type: "integer" }, limit: { type: "integer" }, total: { type: "integer" } } },
  AdminProductPageEnvelope: envelopeOk({ $ref: "#/components/schemas/AdminProductPage" }),

  PaymentIssue: {
    type: "object",
    properties: {
      id: uuid,
      type: { type: "string", enum: ["AMOUNT_MISMATCH", "ORPHAN_CHARGE", "STUCK_PENDING", "PAID_ORDER_NOT_ADVANCED"] },
      status: { type: "string", enum: ["OPEN", "RESOLVED", "IGNORED"] },
      reference: { type: "string" },
      orderId: { ...uuid, nullable: true },
      orderNumber: { type: "string", nullable: true },
      expectedKobo: { ...money, nullable: true },
      observedKobo: { ...money, nullable: true },
      currency: { type: "string", nullable: true },
      detail: { type: "string" },
      context: { nullable: true },
      resolvedAt: { ...dateTime, nullable: true },
      resolvedBy: { type: "string", nullable: true },
      createdAt: dateTime,
      updatedAt: dateTime,
    },
  },
  PaymentIssueEnvelope: envelopeOk({ $ref: "#/components/schemas/PaymentIssue" }),
  PaymentIssuePage: {
    type: "object",
    properties: {
      items: { type: "array", items: { $ref: "#/components/schemas/PaymentIssue" } },
      page: { type: "integer" }, limit: { type: "integer" }, total: { type: "integer" },
      openCount: { type: "integer", description: "Total OPEN issues, regardless of the current filter/page." },
    },
  },
  PaymentIssuePageEnvelope: envelopeOk({ $ref: "#/components/schemas/PaymentIssuePage" }),
  AdminPaymentIssueUpdateRequest: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["RESOLVED", "IGNORED"] } } },

  ImageSignatureRequest: { type: "object", properties: { folder: { type: "string", default: "products", maxLength: 100 } } },
  ImageSignatureResult: {
    type: "object",
    properties: { signature: { type: "string" }, timestamp: { type: "integer" }, apiKey: { type: "string" }, cloudName: { type: "string" }, folder: { type: "string" } },
  },
  ImageSignatureEnvelope: envelopeOk({ $ref: "#/components/schemas/ImageSignatureResult" }),

  AdminCategoryCreateRequest: {
    type: "object",
    required: ["name"],
    properties: { name: { type: "string", maxLength: 120 }, isActive: { type: "boolean", default: true }, sortOrder: { type: "integer", default: 0 } },
  },
  AdminCategoryUpdateRequest: { allOf: [{ $ref: "#/components/schemas/AdminCategoryCreateRequest" }], description: "All fields optional (partial update)." },

  AdminSettingsUpdateRequest: {
    type: "object",
    properties: {
      restaurantName: { type: "string", maxLength: 120 },
      originLat: { type: "number", nullable: true },
      originLng: { type: "number", nullable: true },
      deliveryRatePerKmKobo: { ...money, minimum: 0 },
      minDeliveryFeeKobo: { ...money, minimum: 0 },
      maxDeliveryDistanceKm: { type: "number", nullable: true },
      pickupEnabled: { type: "boolean" },
      deliveryEnabled: { type: "boolean" },
    },
  },

  Customer: {
    type: "object",
    properties: {
      id: uuid,
      phone: { type: "string", example: "+2348012345678" },
      name: { type: "string", nullable: true },
      email: { type: "string", nullable: true },
      emailVerifiedAt: { ...dateTime, nullable: true, description: "Null until the email step of signup is completed." },
      createdAt: dateTime,
    },
  },
  CustomerEnvelope: envelopeOk({ $ref: "#/components/schemas/Customer" }),

  PhoneOtpRequestRequest: {
    type: "object",
    required: ["phone"],
    properties: { phone: { type: "string", example: "08012345678", description: "Nigerian format: +234XXXXXXXXXX or 0XXXXXXXXXX." } },
  },
  PhoneOtpRequestResult: { type: "object", properties: { sent: { type: "boolean" } } },
  PhoneOtpRequestEnvelope: envelopeOk({ $ref: "#/components/schemas/PhoneOtpRequestResult" }),

  PhoneOtpVerifyRequest: {
    type: "object",
    required: ["phone", "code"],
    properties: {
      phone: { type: "string", example: "08012345678" },
      code: { type: "string", pattern: "^\\d{6}$", example: "042817" },
    },
  },
  PhoneOtpVerifyResult: {
    type: "object",
    properties: {
      customer: { $ref: "#/components/schemas/Customer" },
      isNewAccount: { type: "boolean", description: "True the first time this phone number has ever verified — lets the client decide whether to prompt for the email step." },
    },
  },
  PhoneOtpVerifyEnvelope: envelopeOk({ $ref: "#/components/schemas/PhoneOtpVerifyResult" }),

  CustomerLogoutEnvelope: envelopeOk({ type: "object", properties: { loggedOut: { type: "boolean" } } }),

  EmailVerificationRequestRequest: {
    type: "object",
    required: ["email"],
    properties: {
      email: { type: "string", format: "email" },
      name: { type: "string", maxLength: 120, description: "Optional — saved onto the profile alongside sending the code." },
    },
  },
  EmailVerificationRequestResult: { type: "object", properties: { sent: { type: "boolean" } } },
  EmailVerificationRequestEnvelope: envelopeOk({ $ref: "#/components/schemas/EmailVerificationRequestResult" }),

  EmailVerificationConfirmRequest: {
    type: "object",
    required: ["code"],
    properties: { code: { type: "string", pattern: "^\\d{6}$" } },
  },
  EmailVerificationConfirmEnvelope: envelopeOk({ type: "object", properties: { emailVerified: { type: "boolean" } } }),

  MyOrderSummary: {
    type: "object",
    properties: {
      id: uuid,
      orderNumber: { type: "string" },
      status: { $ref: "#/components/schemas/OrderStatus" },
      fulfillmentType: { type: "string", enum: ["PICKUP", "DELIVERY"] },
      totalKobo: money,
      createdAt: dateTime,
    },
  },
  MyOrderPage: {
    type: "object",
    properties: { items: { type: "array", items: { $ref: "#/components/schemas/MyOrderSummary" } }, page: { type: "integer" }, limit: { type: "integer" }, total: { type: "integer" } },
  },
  MyOrderPageEnvelope: envelopeOk({ $ref: "#/components/schemas/MyOrderPage" }),
  MyOrderDetailEnvelope: envelopeOk({
    allOf: [
      { $ref: "#/components/schemas/Order" },
      { type: "object", properties: { payment: { type: "object", nullable: true } } },
    ],
  }),
};

const paginationParams = [
  { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
  { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50, default: 20 }, description: "Server-capped at 50 regardless of what's requested." },
];

const paths = {
  "/api/categories": {
    get: {
      tags: ["Public"], summary: "List active categories",
      responses: { ...okResponse("Active categories, ordered by sortOrder.", "CategoryList"), 500: errorResponse("Internal error.") },
    },
  },
  "/api/products": {
    get: {
      tags: ["Public"], summary: "List active + available products",
      parameters: [...paginationParams, { name: "categoryId", in: "query", schema: { type: "string", format: "uuid" } }],
      responses: { ...okResponse("Paginated product list.", "ProductPage"), 400: errorResponse("Invalid query params.") },
    },
  },
  "/api/products/{id}": {
    get: {
      tags: ["Public"], summary: "Get a single active product",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: { ...okResponse("Product found.", "Product"), 404: errorResponse("Product not found or inactive.") },
    },
  },
  "/api/settings/public": {
    get: {
      tags: ["Public"], summary: "Get public checkout config",
      description: "Never exposes origin coordinates or the raw per-km delivery rate.",
      responses: { ...okResponse("Public settings.", "PublicSettings") },
    },
  },
  "/api/checkout/quote": {
    post: {
      tags: ["Public"], summary: "Preview a checkout total (creates nothing)",
      description: "Runs the exact same fulfillment/range/floor sequence as order creation. Not authoritative — POST /api/orders recomputes it again.",
      requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CheckoutQuoteRequest" } } } },
      responses: {
        ...okResponse("Computed quote.", "CheckoutQuote"),
        400: errorResponse("Validation error, e.g. missing deliveryPin for a DELIVERY order."),
        409: errorResponse("A product in the cart is unavailable."),
        422: errorResponse("Delivery address is out of range, or the requested fulfillment type is disabled."),
      },
    },
  },
  "/api/orders": {
    post: {
      tags: ["Public"], summary: "Create an order",
      description: "Requires a signed-in customer (accounts-only checkout — browsing stays public, ordering doesn't). Rate-limited by IP (10/window). Idempotent on idempotencyKey — resending the same key returns the original order (200) instead of creating a duplicate (201 on first creation); reusing another customer's key is rejected, never returns their order.",
      security: [{ customerSession: [] }],
      requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/CreateOrderRequest" } } } },
      responses: {
        200: { description: "Idempotency key already used — returns the existing order.", content: { "application/json": { schema: { $ref: "#/components/schemas/OrderEnvelope" } } } },
        201: { description: "Order created.", content: { "application/json": { schema: { $ref: "#/components/schemas/OrderEnvelope" } } } },
        400: errorResponse("Validation error, or a reused idempotency key that belongs to a different customer."),
        401: errorResponse("Sign in required."),
        409: errorResponse("A product in the cart is unavailable."),
        422: errorResponse("Delivery out of range or fulfillment type disabled."),
        429: errorResponse("Rate limited."),
      },
    },
  },
  "/api/orders/{orderNumber}": {
    get: {
      tags: ["Public"], summary: "Look up an order (customer-facing)",
      description: "Requires the Payment reference as a second factor — orderNumber alone is not enough to view someone else's order.",
      parameters: [
        { name: "orderNumber", in: "path", required: true, schema: { type: "string" }, example: "ORD-20260828-7K9M2P" },
        { name: "ref", in: "query", required: true, schema: { type: "string" }, description: "The Payment reference issued at /api/payments/initialize." },
      ],
      responses: { ...okResponse("Order found.", "OrderLookup"), 404: errorResponse("No matching order, or ref doesn't match.") },
    },
  },
  "/api/payments/initialize": {
    post: {
      tags: ["Payments"], summary: "Arm (or re-arm) a Paystack transaction for an order",
      description: "Requires the order to belong to the signed-in customer, and their account email to be verified — the account's own verified email is sent to Paystack, never the order's editable customerEmail snapshot. Rate-limited per order and per IP.",
      security: [{ customerSession: [] }],
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["orderId"], properties: { orderId: { type: "string", format: "uuid" } } } } } },
      responses: {
        ...okResponse("Reference + access code for the Paystack popup.", "PaymentInitialize"),
        401: errorResponse("Sign in required."),
        403: errorResponse("Account email is not verified yet."),
        404: errorResponse("Order not found, or doesn't belong to this customer."),
        409: errorResponse("Order already paid, or not in a payable state."),
        429: errorResponse("Rate limited."),
        503: errorResponse("Paystack unreachable."),
      },
    },
  },
  "/api/payments/verify": {
    get: {
      tags: ["Payments"], summary: "Server-authoritative payment verification",
      description: "Called by the frontend after the Paystack popup's onSuccess callback. Never trusts that callback alone — this is what actually decides anything. Shares logic with the webhook so both can never disagree.",
      parameters: [{ name: "reference", in: "query", required: true, schema: { type: "string" } }],
      responses: { ...okResponse("Verification result.", "PaymentVerify"), 404: errorResponse("Unknown reference."), 402: errorResponse("Paystack reports the payment failed.") },
    },
  },
  "/api/paystack/webhook": {
    post: {
      tags: ["Payments"], summary: "Paystack webhook receiver",
      description: "Signature-verified via the x-paystack-signature header (HMAC-SHA512 of the raw body). Not callable meaningfully from Swagger UI — Paystack signs the exact raw bytes it sends, so a hand-built request here will always fail signature verification. Included for completeness.",
      requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
      responses: {
        200: { description: "Acknowledged (event processed, ignored, or a safe no-op on an unknown reference)." },
        401: { description: "Invalid or missing signature." },
        500: { description: "Processing failed — Paystack will retry." },
      },
    },
  },
  "/api/admin/auth/login": {
    post: {
      tags: ["Admin — Auth"], summary: "Admin login",
      description: "Sets the admin_session cookie on success. Rate-limited by IP (10/window) and by per-account lockout (5 failed attempts locks the account 15 minutes).",
      requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/AdminLoginRequest" } } } },
      responses: {
        ...okResponse("Logged in.", "AdminIdentity"),
        401: errorResponse("Invalid credentials."),
        423: errorResponse("Account locked."),
        429: errorResponse("Rate limited."),
      },
    },
  },
  "/api/admin/auth/logout": {
    post: { tags: ["Admin — Auth"], summary: "Admin logout", description: "Clears the session cookie.", responses: okResponse("Logged out.", "AdminLogout") },
  },
  "/api/admin/auth/me": {
    get: {
      tags: ["Admin — Auth"], summary: "Current admin identity",
      security: [{ adminSession: [] }],
      responses: { ...okResponse("Current session.", "AdminIdentity"), 401: errorResponse("Not logged in.") },
    },
  },
  "/api/admin/orders": {
    get: {
      tags: ["Admin — Orders"], summary: "List orders",
      security: [{ adminSession: [] }],
      parameters: [...paginationParams, { name: "status", in: "query", schema: { $ref: "#/components/schemas/OrderStatus" } }],
      responses: { ...okResponse("Paginated order list.", "AdminOrderPage"), 401: errorResponse("Not logged in.") },
    },
  },
  "/api/admin/orders/{id}": {
    get: {
      tags: ["Admin — Orders"], summary: "Full order detail",
      security: [{ adminSession: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: { ...okResponse("Full order — items, payment, customer info.", "AdminOrderDetail"), 401: errorResponse("Not logged in."), 404: errorResponse("Order not found.") },
    },
  },
  "/api/admin/orders/{id}/status": {
    patch: {
      tags: ["Admin — Orders"], summary: "Change order status",
      description: "Validated against an explicit transition allow-list. Conflict-safe: if the order changed since you read it, this returns 409 CONFLICT rather than clobbering a concurrent edit.",
      security: [{ adminSession: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/AdminOrderStatusUpdateRequest" } } } },
      responses: {
        ...okResponse("Updated order.", "AdminOrderDetail"),
        401: errorResponse("Not logged in."),
        404: errorResponse("Order not found."),
        409: errorResponse("Invalid transition, or a concurrent edit won the race."),
      },
    },
  },
  "/api/admin/products": {
    get: {
      tags: ["Admin — Products"], summary: "List all products (including inactive)",
      security: [{ adminSession: [] }],
      parameters: paginationParams,
      responses: { ...okResponse("Paginated product list.", "AdminProductPage"), 401: errorResponse("Not logged in.") },
    },
    post: {
      tags: ["Admin — Products"], summary: "Create a product",
      security: [{ adminSession: [] }],
      requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/AdminProductCreateRequest" } } } },
      responses: { ...okResponse("Created.", "Product", 201), 400: errorResponse("Validation error."), 401: errorResponse("Not logged in.") },
    },
  },
  "/api/admin/products/{id}": {
    patch: {
      tags: ["Admin — Products"], summary: "Update a product (partial)",
      security: [{ adminSession: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/AdminProductUpdateRequest" } } } },
      responses: { ...okResponse("Updated.", "Product"), 401: errorResponse("Not logged in."), 404: errorResponse("Not found.") },
    },
    delete: {
      tags: ["Admin — Products"], summary: "Soft-delete a product",
      description: "Never a hard delete — sets isActive=false and isAvailable=false. Historical orders keep their snapshot regardless.",
      security: [{ adminSession: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: { ...okResponse("Deactivated product.", "Product"), 401: errorResponse("Not logged in."), 404: errorResponse("Not found.") },
    },
  },
  "/api/admin/products/{id}/image-signature": {
    post: {
      tags: ["Admin — Products"], summary: "Get a signed Cloudinary upload signature",
      description: "The server never proxies image bytes — the admin UI uploads directly to Cloudinary using this short-lived signature.",
      security: [{ adminSession: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/ImageSignatureRequest" } } } },
      responses: { ...okResponse("Signature payload for the Cloudinary direct upload.", "ImageSignature"), 401: errorResponse("Not logged in."), 404: errorResponse("Product not found.") },
    },
  },
  "/api/admin/categories": {
    get: {
      tags: ["Admin — Categories"], summary: "List all categories (including inactive)",
      security: [{ adminSession: [] }],
      responses: { ...okResponse("All categories, ordered by sortOrder.", "CategoryList"), 401: errorResponse("Not logged in.") },
    },
    post: {
      tags: ["Admin — Categories"], summary: "Create a category",
      security: [{ adminSession: [] }],
      requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/AdminCategoryCreateRequest" } } } },
      responses: { ...okResponse("Created.", "Category", 201), 400: errorResponse("Validation error."), 401: errorResponse("Not logged in.") },
    },
  },
  "/api/admin/categories/{id}": {
    patch: {
      tags: ["Admin — Categories"], summary: "Update a category (partial)",
      description: "No DELETE route — a category referencing products can't be removed (Restrict FK). Deactivate via isActive:false instead.",
      security: [{ adminSession: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/AdminCategoryUpdateRequest" } } } },
      responses: { ...okResponse("Updated.", "Category"), 401: errorResponse("Not logged in."), 404: errorResponse("Not found.") },
    },
  },
  "/api/admin/settings": {
    get: {
      tags: ["Admin — Settings"], summary: "Get restaurant settings",
      security: [{ adminSession: [] }],
      responses: { ...okResponse("Full settings row.", "Settings"), 401: errorResponse("Not logged in.") },
    },
    patch: {
      tags: ["Admin — Settings"], summary: "Update restaurant settings",
      description: "Where deliveryRatePerKmKobo and minDeliveryFeeKobo get set once confirmed with the client — both default to 0. Invalidates the cached storefront copy of settings.",
      security: [{ adminSession: [] }],
      requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/AdminSettingsUpdateRequest" } } } },
      responses: { ...okResponse("Updated settings.", "Settings"), 401: errorResponse("Not logged in.") },
    },
  },
  "/api/admin/payments": {
    get: {
      tags: ["Admin — Payments"], summary: "List payment anomalies",
      description: "PaymentIssue rows — amount mismatches, orphan charges, stuck-pending payments, paid-but-not-advanced orders. Defaults to OPEN; `?status=` widens it. `openCount` is always the total open count.",
      security: [{ adminSession: [] }],
      parameters: [...paginationParams, { name: "status", in: "query", schema: { type: "string", enum: ["OPEN", "RESOLVED", "IGNORED"] } }],
      responses: { ...okResponse("Paginated payment-issue list.", "PaymentIssuePage"), 401: errorResponse("Not logged in.") },
    },
  },
  "/api/admin/payments/{id}": {
    patch: {
      tags: ["Admin — Payments"], summary: "Close a payment issue",
      description: "Mark an issue RESOLVED or IGNORED once a human has dealt with it. One-way — the system re-opens the row itself if the same anomaly recurs.",
      security: [{ adminSession: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/AdminPaymentIssueUpdateRequest" } } } },
      responses: { ...okResponse("Updated issue.", "PaymentIssue"), 400: errorResponse("Validation error."), 401: errorResponse("Not logged in."), 404: errorResponse("Issue not found.") },
    },
  },
  "/api/admin/orders/bulk-status": {
    patch: {
      tags: ["Admin — Orders"], summary: "Advance many orders at once",
      description: "{ orderIds: string[1..30], target?: OrderStatus }. No target = advance each order one step (fulfilment-aware). Per-order results; illegal or conflicting rows are skipped, not fatal. Fires the customer notification for each order that moved.",
      security: [{ adminSession: [] }],
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["orderIds"], properties: { orderIds: { type: "array", items: { type: "string", format: "uuid" }, minItems: 1, maxItems: 30 }, target: { $ref: "#/components/schemas/OrderStatus" } } } } } },
      responses: { 200: { description: "Per-order results.", content: { "application/json": { schema: { type: "object" } } } }, 401: errorResponse("Not logged in.") },
    },
  },
  "/api/menu/index": {
    get: {
      tags: ["Public"], summary: "Full menu for client-side smart search",
      description: "Every active + available product (id, name, description, price, image, categoryId, tags) in one payload. Cached + CDN-cacheable.",
      responses: { 200: { description: "Menu index.", content: { "application/json": { schema: { type: "object" } } } } },
    },
  },
  "/api/search/assist": {
    post: {
      tags: ["Public"], summary: "AI concierge (search Layer 4)",
      description: "{ query }. Called only after deterministic search fails. Returns { available:false } if ANTHROPIC_API_KEY is unset. Rate-limited per IP; identical normalised queries cached ~1h (busted on menu edits). Every returned product id is re-validated against the DB; names/prices/images come from the DB row.",
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["query"], properties: { query: { type: "string", minLength: 2, maxLength: 300 } } } } } },
      responses: { 200: { description: "Concierge result or { available:false }.", content: { "application/json": { schema: { type: "object" } } } }, 429: errorResponse("Rate limited.") },
    },
  },
  "/api/me/notifications": {
    get: {
      tags: ["Customer Accounts"], summary: "In-app notifications",
      description: "Paginated, newest first. Always returns unreadCount. ?unread=1 for unread only.",
      security: [{ customerSession: [] }],
      parameters: [...paginationParams, { name: "unread", in: "query", schema: { type: "string", enum: ["1"] } }],
      responses: { 200: { description: "Notification page + unreadCount.", content: { "application/json": { schema: { type: "object" } } } }, 401: errorResponse("Sign in required.") },
    },
    patch: {
      tags: ["Customer Accounts"], summary: "Mark all notifications read",
      security: [{ customerSession: [] }],
      responses: { 200: { description: "{ marked }.", content: { "application/json": { schema: { type: "object" } } } }, 401: errorResponse("Sign in required.") },
    },
  },
  "/api/me/notifications/{id}": {
    patch: {
      tags: ["Customer Accounts"], summary: "Mark one notification read",
      security: [{ customerSession: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: { 200: { description: "{ read: true }.", content: { "application/json": { schema: { type: "object" } } } }, 401: errorResponse("Sign in required."), 404: errorResponse("Not found.") },
    },
  },
  "/api/me/push/subscribe": {
    post: {
      tags: ["Customer Accounts"], summary: "Register a Web Push subscription",
      security: [{ customerSession: [] }],
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["subscription"], properties: { subscription: { type: "object" } } } } } },
      responses: { 200: { description: "{ saved: true }.", content: { "application/json": { schema: { type: "object" } } } }, 401: errorResponse("Sign in required.") },
    },
    delete: {
      tags: ["Customer Accounts"], summary: "Remove a Web Push subscription",
      security: [{ customerSession: [] }],
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["endpoint"], properties: { endpoint: { type: "string" } } } } } },
      responses: { 200: { description: "{ removed: true }.", content: { "application/json": { schema: { type: "object" } } } }, 401: errorResponse("Sign in required.") },
    },
  },
  "/api/internal/reconcile-payments": {
    post: {
      tags: ["Internal"], summary: "Run the payment reconciler + table sweep",
      description: "Not part of the public/customer/admin surface. Authenticated by `Authorization: Bearer $RECONCILE_SECRET`. Re-verifies stale PENDING payments against Paystack and applies missed outcomes, heals paid-but-unadvanced orders, escalates the genuinely-stuck to PaymentIssue rows, and sweeps expired RateLimit/OTP rows. Called every ~10 min by a Netlify scheduled function; safe to invoke by hand. GET behaves identically.",
      security: [{ reconcileSecret: [] }],
      responses: { 200: { description: "Run summary (counts).", content: { "application/json": { schema: { type: "object" } } } }, 401: errorResponse("Missing or wrong bearer token.") },
    },
  },

  "/api/auth/otp/request": {
    post: {
      tags: ["Customer Accounts"], summary: "Request an OTP (signup or login, same endpoint)",
      description: "One screen for both cases — never reveals whether the phone number is already registered; a code is texted either way. Rate-limited by phone (5/window) and by IP (15/window): unlike most limits in this app, abuse here has a direct SMS cost.",
      requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/PhoneOtpRequestRequest" } } } },
      responses: { ...okResponse("Code sent.", "PhoneOtpRequest"), 400: errorResponse("Invalid phone number."), 429: errorResponse("Rate limited.") },
    },
  },
  "/api/auth/otp/verify": {
    post: {
      tags: ["Customer Accounts"], summary: "Verify the OTP, sign in (creating the account on first use)",
      description: "Sets the customer_session cookie on success. A Customer row is created here, on first successful verification for a phone number — never on request alone, so an abandoned OTP request never leaves a junk account behind.",
      requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/PhoneOtpVerifyRequest" } } } },
      responses: {
        ...okResponse("Signed in.", "PhoneOtpVerify"),
        400: errorResponse("Incorrect or expired code."),
        429: errorResponse("Rate limited."),
      },
    },
  },
  "/api/auth/customer/logout": {
    post: {
      tags: ["Customer Accounts"], summary: "Customer logout",
      description: "Clears the customer_session cookie.",
      responses: okResponse("Logged out.", "CustomerLogout"),
    },
  },
  "/api/auth/email/request": {
    post: {
      tags: ["Customer Accounts"], summary: "Request an email verification code",
      description: "Second step of signup — a Customer must already be signed in (phone-verified). Saves the email onto the profile immediately, unverified, and sends a 6-digit code to it.",
      security: [{ customerSession: [] }],
      requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/EmailVerificationRequestRequest" } } } },
      responses: { ...okResponse("Code sent.", "EmailVerificationRequest"), 401: errorResponse("Sign in required."), 429: errorResponse("Rate limited.") },
    },
  },
  "/api/auth/email/confirm": {
    post: {
      tags: ["Customer Accounts"], summary: "Confirm the email verification code",
      description: "Sets Customer.emailVerifiedAt — the one thing POST /api/payments/initialize actually requires. Browsing and building a cart never depended on this; only paying does.",
      security: [{ customerSession: [] }],
      requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/EmailVerificationConfirmRequest" } } } },
      responses: { ...okResponse("Email verified.", "EmailVerificationConfirm"), 400: errorResponse("Incorrect or expired code."), 401: errorResponse("Sign in required.") },
    },
  },
  "/api/me": {
    get: {
      tags: ["Customer Accounts"], summary: "Current customer profile",
      security: [{ customerSession: [] }],
      responses: { ...okResponse("Profile.", "Customer"), 401: errorResponse("Sign in required.") },
    },
    patch: {
      tags: ["Customer Accounts"], summary: "Update profile preferences",
      description: "{ orderUpdatesOptOut? } — opt in/out of SMS + email order updates. In-app + push unaffected.",
      security: [{ customerSession: [] }],
      requestBody: { content: { "application/json": { schema: { type: "object", properties: { orderUpdatesOptOut: { type: "boolean" } } } } } },
      responses: { ...okResponse("Updated profile.", "Customer"), 401: errorResponse("Sign in required.") },
    },
  },
  "/api/me/orders": {
    get: {
      tags: ["Customer Accounts"], summary: "This customer's order history",
      security: [{ customerSession: [] }],
      parameters: paginationParams,
      responses: { ...okResponse("Paginated order history.", "MyOrderPage"), 401: errorResponse("Sign in required.") },
    },
  },
  "/api/me/orders/{orderNumber}": {
    get: {
      tags: ["Customer Accounts"], summary: "One of this customer's orders, in full",
      description: "Same not-found response whether the order doesn't exist or simply isn't this customer's — never confirms another customer's order number is valid.",
      security: [{ customerSession: [] }],
      parameters: [{ name: "orderNumber", in: "path", required: true, schema: { type: "string" }, example: "ORD-20260828-7K9M2P" }],
      responses: { ...okResponse("Full order detail.", "MyOrderDetail"), 401: errorResponse("Sign in required."), 404: errorResponse("Order not found, or not this customer's.") },
    },
  },
};

const spec = {
  openapi: "3.0.3",
  info: {
    title: "Restaurant Ordering Platform API",
    version: "1.0.0",
    description:
      "Every response is `{ success: true, data }` or `{ success: false, error: { code, message } }`. " +
      "All money fields are integer kobo. Admin routes require the admin_session cookie (log in via " +
      "POST /api/admin/auth/login below, then Swagger UI will carry the cookie automatically on " +
      "same-origin requests). State-changing admin requests also require a matching Origin header, " +
      "which the browser sets automatically when this page is served from the same app. " +
      "Checkout is accounts-only: customer routes require the customer_session cookie (obtained via " +
      "POST /api/auth/otp/request then POST /api/auth/otp/verify below), separate from admin_session " +
      "and carried the same way by Swagger UI on same-origin requests.",
  },
  servers: [{ url: "/", description: "Same origin as this docs page" }],
  tags: [
    { name: "Public" }, { name: "Payments" }, { name: "Customer Accounts" }, { name: "Admin — Auth" },
    { name: "Admin — Orders" }, { name: "Admin — Products" }, { name: "Admin — Categories" }, { name: "Admin — Settings" },
  ],
  components: {
    securitySchemes: {
      adminSession: { type: "apiKey", in: "cookie", name: "admin_session" },
      customerSession: { type: "apiKey", in: "cookie", name: "customer_session" },
      reconcileSecret: { type: "http", scheme: "bearer", description: "RECONCILE_SECRET, for the internal reconcile cron only." },
    },
    schemas,
  },
  paths,
};

writeFileSync(new URL("../public/openapi.json", import.meta.url), JSON.stringify(spec, null, 2) + "\n");
console.log("Wrote public/openapi.json");
