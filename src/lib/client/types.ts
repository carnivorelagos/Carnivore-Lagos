/**
 * Frontend-facing shapes for the existing API (documented in API.md, and
 * verified against the route handlers in src/app/api/**). These are the
 * `data` payloads only - the { success, data } / { success, error }
 * envelope is unwrapped by `apiFetch` in ./api.ts.
 *
 * Prisma `Decimal` columns (deliveryLat/Lng/DistanceKm, settings origin*)
 * arrive as JSON strings on the raw order includes, and as numbers on the
 * settings endpoint (src/lib/settings.ts converts them). Types below
 * reflect that difference deliberately.
 */

export type ApiEnvelopeError = {
  success: false;
  error: { code: string; message: string; details?: unknown };
};

// --- Enums (mirror prisma/schema.prisma) --------------------------------

export type FulfillmentType = "PICKUP" | "DELIVERY";

export const ORDER_STATUSES = [
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
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED";
export type AdminRole = "ADMIN" | "SUPER_ADMIN";

// --- Catalogue --------------------------------------------------------

export type Category = { id: string; name: string; sortOrder: number };

export type ProductListItem = {
  id: string;
  name: string;
  description: string | null;
  priceKobo: number;
  imageUrl: string | null;
  categoryId: string;
};

export type ProductListResponse = {
  items: ProductListItem[];
  page: number;
  limit: number;
  total: number;
};

export type ProductDetail = ProductListItem & { isAvailable: boolean };

// --- Smart search / concierge ---------------------------------------

export type MenuIndexItem = {
  id: string;
  name: string;
  description: string | null;
  priceKobo: number;
  imageUrl: string | null;
  categoryId: string;
  tags: string[];
};

export type ConciergePick = {
  productId: string;
  name: string;
  priceKobo: number;
  imageUrl: string | null;
  reason: string;
};

export type AssistResult =
  | { available: false; reason: string }
  | {
      available: true;
      intro: string;
      picks: ConciergePick[];
      note: string | null;
      onMenu: boolean;
    };

export type PublicSettings = {
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  maxDeliveryDistanceKm: number | null;
};

// --- Checkout / orders ----------------------------------------------

export type LatLng = { lat: number; lng: number };

export type CheckoutRequestBody = {
  fulfillmentType: FulfillmentType;
  items: { productId: string; quantity: number }[];
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryAddress?: string;
  deliveryPin?: LatLng;
  notes?: string;
};

export type CreateOrderBody = CheckoutRequestBody & { idempotencyKey: string };

export type QuoteLineItem = {
  productId: string;
  productName: string;
  unitPriceKobo: number;
  quantity: number;
  lineTotalKobo: number;
};

export type CheckoutQuote = {
  lineItems: QuoteLineItem[];
  subtotalKobo: number;
  deliveryFeeKobo: number;
  totalKobo: number;
  deliveryDistanceKm: number | null;
};

export type OrderItemLine = {
  productId: string;
  productNameSnapshot: string;
  unitPriceKobo: number;
  quantity: number;
  lineTotalKobo: number;
};

export type CreatedOrder = {
  id: string;
  orderNumber: string;
  trackingSlug: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  subtotalKobo: number;
  deliveryFeeKobo: number;
  totalKobo: number;
  deliveryDistanceKm: number | string | null;
  createdAt: string;
  items: OrderItemLine[];
};

// --- Payments -------------------------------------------------------

export type PaymentInit = { reference: string; accessCode: string };

export type PaymentVerifyResult = {
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  amountMismatch: boolean;
};

// --- Public order tracking (order/[slug]) — slug is the capability -----

export type PublicOrder = {
  id: string;
  orderNumber: string;
  trackingSlug: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  customerName: string;
  deliveryAddress: string | null;
  notes: string | null;
  subtotalKobo: number;
  deliveryFeeKobo: number;
  totalKobo: number;
  createdAt: string;
  items: {
    productNameSnapshot: string;
    unitPriceKobo: number;
    quantity: number;
    lineTotalKobo: number;
  }[];
  payment: { status: PaymentStatus; paidAt: string | null } | null;
  /** True when the request came from the device that placed this order. */
  ownedByThisDevice: boolean;
  /** True when this device can pay the still-unpaid order with a saved card. */
  canPayWithSavedCard: boolean;
  savedCardLabel: string | null;
};

// --- Device history / no-login (amendments 2-4) -----------------------

export type HistoryOrder = {
  trackingSlug: string;
  orderNumber: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  totalKobo: number;
  createdAt: string;
  items: { productNameSnapshot: string; quantity: number }[];
};

export type DeviceHistory = {
  orders: HistoryOrder[];
  savedCard: { brand: string | null; last4: string | null } | null;
  secured: boolean;
  securedEmail: string | null;
};

export type ReorderLine = {
  productId: string | null;
  name: string;
  quantity: number;
  priceKobo: number | null;
  imageUrl: string | null;
  available: boolean;
};

export type ReorderResult = { lines: ReorderLine[] };

// --- Customer account ---------------------------------------------

export type Customer = {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  emailVerifiedAt: string | null;
  orderUpdatesOptOut?: boolean;
  createdAt?: string;
};

export type OtpVerifyResult = { customer: Customer; isNewAccount: boolean };

// --- Notifications ------------------------------------------------------

export type NotificationType =
  | "PAYMENT_CONFIRMED"
  | "ORDER_CONFIRMED"
  | "ORDER_PREPARING"
  | "ORDER_READY"
  | "ORDER_OUT_FOR_DELIVERY"
  | "ORDER_DELIVERED"
  | "ORDER_COMPLETED"
  | "ORDER_CANCELLED";

export type AppNotification = {
  id: string;
  orderId: string | null;
  orderNumber: string | null;
  type: NotificationType;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export type NotificationList = Paginated<AppNotification> & { unreadCount: number };

export type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
};

export type MyOrderListItem = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  totalKobo: number;
  createdAt: string;
};

export type FullOrderItemRow = OrderItemLine & { id: string; orderId: string };

export type MyOrderDetail = {
  id: string;
  orderNumber: string;
  idempotencyKey?: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  deliveryAddress: string | null;
  deliveryLat: string | null;
  deliveryLng: string | null;
  deliveryDistanceKm: string | null;
  notes: string | null;
  subtotalKobo: number;
  deliveryFeeKobo: number;
  totalKobo: number;
  createdAt: string;
  updatedAt: string;
  items: FullOrderItemRow[];
  payment: { reference: string; status: PaymentStatus; paidAt: string | null } | null;
};

// --- Admin --------------------------------------------------------

export type AdminIdentity = { id: string; email: string; role: AdminRole };

export type AdminOrderListItem = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  customerName: string;
  totalKobo: number;
  createdAt: string;
  payment: { status: PaymentStatus } | null;
};

export type AdminPaymentRow = {
  id: string;
  orderId: string;
  provider: string;
  reference: string;
  status: PaymentStatus;
  amountKobo: number;
  currency: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminOrderDetail = Omit<MyOrderDetail, "payment"> & {
  payment: AdminPaymentRow | null;
};

export type PaymentIssueType =
  | "AMOUNT_MISMATCH"
  | "ORPHAN_CHARGE"
  | "STUCK_PENDING"
  | "PAID_ORDER_NOT_ADVANCED";

export type PaymentIssueStatus = "OPEN" | "RESOLVED" | "IGNORED";

export type AdminPaymentIssue = {
  id: string;
  type: PaymentIssueType;
  status: PaymentIssueStatus;
  reference: string;
  orderId: string | null;
  orderNumber: string | null;
  expectedKobo: number | null;
  observedKobo: number | null;
  currency: string | null;
  detail: string;
  context: unknown;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminPaymentIssueList = Paginated<AdminPaymentIssue> & { openCount: number };

export type AdminProduct = {
  id: string;
  name: string;
  description: string | null;
  priceKobo: number;
  categoryId: string;
  imageUrl: string | null;
  imagePublicId: string | null;
  isActive: boolean;
  isAvailable: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type AdminCategory = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminSettings = {
  restaurantName: string;
  originLat: number | null;
  originLng: number | null;
  deliveryRatePerKmKobo: number;
  minDeliveryFeeKobo: number;
  maxDeliveryDistanceKm: number | null;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  autoConfirmPaidOrders: boolean;
};

export type BulkStatusRowResult = {
  id: string;
  ok: boolean;
  from?: OrderStatus;
  to?: OrderStatus;
  error?: string;
};
export type BulkStatusResult = {
  results: BulkStatusRowResult[];
  moved: number;
  failed: number;
};

export type ImageSignature = {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
};
