import { apiFetch, apiRead } from "./api";
import type {
  AdminCategory,
  AdminIdentity,
  NotificationList,
  AdminOrderDetail,
  AdminOrderListItem,
  AdminPaymentIssue,
  AdminPaymentIssueList,
  AdminProduct,
  AdminSettings,
  AssistResult,
  BulkStatusResult,
  Category,
  MenuIndexItem,
  CheckoutQuote,
  CheckoutRequestBody,
  CreateOrderBody,
  CreatedOrder,
  Customer,
  DeviceHistory,
  ImageSignature,
  MyOrderDetail,
  MyOrderListItem,
  OrderStatus,
  OtpVerifyResult,
  Paginated,
  PaymentInit,
  PaymentVerifyResult,
  ProductDetail,
  ProductListResponse,
  PublicOrder,
  PublicSettings,
  ReorderResult,
} from "./types";

/* ----------------------------------------------------------------------
   Public catalogue (reads - retry-safe)
---------------------------------------------------------------------- */

export const getCategories = () => apiRead<Category[]>("/api/categories");

export const getProducts = (params?: {
  categoryId?: string;
  page?: number;
  limit?: number;
}) => apiRead<ProductListResponse>("/api/products", { query: params });

export const getProduct = (id: string) => apiRead<ProductDetail>(`/api/products/${id}`);

export const getPublicSettings = () => apiRead<PublicSettings>("/api/settings/public");

/** Best-effort: turns a delivery pin into a human-readable address. */
export const reverseGeocode = (lat: number, lng: number) =>
  apiRead<{ address: string | null }>("/api/geocode/reverse", { query: { lat, lng } });

/** Full active menu for the client-side smart search. */
export const getMenuIndex = () => apiRead<{ items: MenuIndexItem[] }>("/api/menu/index");

/** AI concierge — deterministic search should be tried first (search.ts). */
export const searchAssist = (query: string) =>
  apiFetch<AssistResult>("/api/search/assist", { body: { query } });

/* ----------------------------------------------------------------------
   Checkout (mutations - client only, never retried)
---------------------------------------------------------------------- */

export const getQuote = (body: CheckoutRequestBody) =>
  apiFetch<CheckoutQuote>("/api/checkout/quote", { body });

export const createOrder = (body: CreateOrderBody) =>
  apiFetch<CreatedOrder>("/api/orders", { body });

/** Public order tracking by unguessable slug (no second factor). */
export const getOrderBySlug = (slug: string) =>
  apiRead<PublicOrder>(`/api/orders/${encodeURIComponent(slug)}`);

/* ----------------------------------------------------------------------
   Device history / no-login (amendments 2-4)
---------------------------------------------------------------------- */

export const getHistory = () => apiRead<DeviceHistory>("/api/history");

export const reorder = (trackingSlug: string) =>
  apiFetch<ReorderResult>("/api/history/reorder", { body: { trackingSlug } });

export const secureHistory = (email: string) =>
  apiFetch<{ sent: boolean }>("/api/history/secure", { body: { email } });

/* ----------------------------------------------------------------------
   Payments
---------------------------------------------------------------------- */

export const initializePayment = (orderId: string) =>
  apiFetch<PaymentInit>("/api/payments/initialize", { body: { orderId } });

export const verifyPayment = (reference: string) =>
  apiFetch<PaymentVerifyResult>("/api/payments/verify", {
    method: "GET",
    query: { reference },
  });

/** Pay a still-unpaid order with the device's saved card (amendment 3). */
export const chargeSavedCard = (trackingSlug: string) =>
  apiFetch<PaymentVerifyResult>("/api/payments/charge-authorization", {
    body: { trackingSlug },
  });

/* ----------------------------------------------------------------------
   Customer auth + account
---------------------------------------------------------------------- */

export const requestPhoneOtp = (phone: string) =>
  apiFetch<{ sent: boolean }>("/api/auth/otp/request", { body: { phone } });

export const verifyPhoneOtp = (phone: string, code: string) =>
  apiFetch<OtpVerifyResult>("/api/auth/otp/verify", { body: { phone, code } });

export const customerLogout = () =>
  apiFetch<{ loggedOut: boolean }>("/api/auth/customer/logout", { method: "POST" });

export const requestEmailVerification = (email: string, name?: string) =>
  apiFetch<{ sent: boolean }>("/api/auth/email/request", {
    body: name ? { email, name } : { email },
  });

export const confirmEmailVerification = (code: string) =>
  apiFetch<{ emailVerified: boolean }>("/api/auth/email/confirm", { body: { code } });

export const getMe = () => apiFetch<Customer>("/api/me", { method: "GET" });

export const updateMe = (body: { orderUpdatesOptOut?: boolean }) =>
  apiFetch<Customer>("/api/me", { method: "PATCH", body });

export const getMyOrders = (params?: { page?: number; limit?: number }) =>
  apiRead<Paginated<MyOrderListItem>>("/api/me/orders", { query: params });

export const getMyOrder = (orderNumber: string) =>
  apiRead<MyOrderDetail>(`/api/me/orders/${encodeURIComponent(orderNumber)}`);

export const getMyNotifications = (params?: { page?: number; limit?: number; unread?: boolean }) =>
  apiRead<NotificationList>("/api/me/notifications", {
    query: params ? { ...params, unread: params.unread ? "1" : undefined } : undefined,
  });

export const markNotificationRead = (id: string) =>
  apiFetch<{ read: boolean }>(`/api/me/notifications/${id}`, { method: "PATCH", body: {} });

export const markAllNotificationsRead = () =>
  apiFetch<{ marked: number }>("/api/me/notifications", { method: "PATCH", body: {} });

export const savePushSubscription = (sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) => apiFetch<{ saved: boolean }>("/api/me/push/subscribe", { body: { subscription: sub } });

export const deletePushSubscription = (endpoint: string) =>
  apiFetch<{ removed: boolean }>("/api/me/push/subscribe", { method: "DELETE", body: { endpoint } });

export const saveAdminPushSubscription = (sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) => apiFetch<{ saved: boolean }>("/api/admin/push/subscribe", { body: { subscription: sub } });

export const deleteAdminPushSubscription = (endpoint: string) =>
  apiFetch<{ removed: boolean }>("/api/admin/push/subscribe", { method: "DELETE", body: { endpoint } });

/* ----------------------------------------------------------------------
   Admin
---------------------------------------------------------------------- */

export const adminLogin = (email: string, password: string) =>
  apiFetch<AdminIdentity>("/api/admin/auth/login", { body: { email, password } });

export const adminLogout = () =>
  apiFetch<{ loggedOut: boolean }>("/api/admin/auth/logout", { method: "POST" });

export const adminMe = () => apiFetch<AdminIdentity>("/api/admin/auth/me", { method: "GET" });

export const adminGetOrders = (params?: {
  status?: OrderStatus;
  page?: number;
  limit?: number;
}) => apiRead<Paginated<AdminOrderListItem>>("/api/admin/orders", { query: params });

export const adminGetOrder = (id: string) =>
  apiRead<AdminOrderDetail>(`/api/admin/orders/${id}`);

export const adminSetOrderStatus = (id: string, status: OrderStatus) =>
  apiFetch<AdminOrderDetail>(`/api/admin/orders/${id}/status`, {
    method: "PATCH",
    body: { status },
  });

/** Advance many orders one step each (no target) or to a specific status. */
export const adminBulkOrderStatus = (orderIds: string[], target?: OrderStatus) =>
  apiFetch<BulkStatusResult>("/api/admin/orders/bulk-status", {
    method: "PATCH",
    body: target ? { orderIds, target } : { orderIds },
  });

export const adminGetProducts = (params?: { page?: number; limit?: number }) =>
  apiRead<Paginated<AdminProduct>>("/api/admin/products", { query: params });

export const adminGetPaymentIssues = (params?: {
  status?: "OPEN" | "RESOLVED" | "IGNORED";
  page?: number;
  limit?: number;
}) => apiRead<AdminPaymentIssueList>("/api/admin/payments", { query: params });

export const adminResolvePaymentIssue = (id: string, status: "RESOLVED" | "IGNORED") =>
  apiFetch<AdminPaymentIssue>(`/api/admin/payments/${id}`, { method: "PATCH", body: { status } });

/** Pages through the admin product list (there is no admin GET-by-id route). */
export async function adminGetAllProducts(): Promise<AdminProduct[]> {
  const first = await adminGetProducts({ page: 1, limit: 50 });
  const pages = Math.max(1, Math.ceil(first.total / 50));
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) => adminGetProducts({ page: i + 2, limit: 50 })),
  );
  return [first, ...rest].flatMap((p) => p.items);
}

export async function adminGetProductById(id: string): Promise<AdminProduct | null> {
  const all = await adminGetAllProducts();
  return all.find((p) => p.id === id) ?? null;
}

export type AdminProductInput = {
  name: string;
  description?: string;
  priceKobo: number;
  categoryId: string;
  imageUrl?: string;
  imagePublicId?: string;
  isActive?: boolean;
  isAvailable?: boolean;
  tags?: string[];
};

export const adminCreateProduct = (body: AdminProductInput) =>
  apiFetch<AdminProduct>("/api/admin/products", { body });

export const adminUpdateProduct = (id: string, body: Partial<AdminProductInput>) =>
  apiFetch<AdminProduct>(`/api/admin/products/${id}`, { method: "PATCH", body });

export const adminDeactivateProduct = (id: string) =>
  apiFetch<AdminProduct>(`/api/admin/products/${id}`, { method: "DELETE" });

export const adminGetImageSignature = (productId: string) =>
  apiFetch<ImageSignature>(`/api/admin/products/${productId}/image-signature`, {
    body: { folder: "products" },
  });

export const adminGetCategories = () => apiRead<AdminCategory[]>("/api/admin/categories");

export type AdminCategoryInput = { name: string; isActive?: boolean; sortOrder?: number };

export const adminCreateCategory = (body: AdminCategoryInput) =>
  apiFetch<AdminCategory>("/api/admin/categories", { body });

export const adminUpdateCategory = (id: string, body: Partial<AdminCategoryInput>) =>
  apiFetch<AdminCategory>(`/api/admin/categories/${id}`, { method: "PATCH", body });

export const adminGetSettings = () => apiRead<AdminSettings>("/api/admin/settings");

export type AdminSettingsInput = Partial<{
  restaurantName: string;
  originLat: number | null;
  originLng: number | null;
  deliveryRatePerKmKobo: number;
  minDeliveryFeeKobo: number;
  maxDeliveryDistanceKm: number | null;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  autoConfirmPaidOrders: boolean;
}>;

export const adminUpdateSettings = (body: AdminSettingsInput) =>
  apiFetch<AdminSettings>("/api/admin/settings", { method: "PATCH", body });

/* ----------------------------------------------------------------------
   Cloudinary direct upload (Section 35) - not our API, uses the signed
   params from adminGetImageSignature.
---------------------------------------------------------------------- */

export type CloudinaryUploadResult = { secure_url: string; public_id: string };

export async function uploadToCloudinary(
  file: File,
  sig: ImageSignature,
): Promise<CloudinaryUploadResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("folder", sig.folder);
  form.append("signature", sig.signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
    { method: "POST", body: form },
  );
  const json = (await res.json().catch(() => null)) as
    | (CloudinaryUploadResult & { error?: { message?: string } })
    | null;

  if (!res.ok || !json?.secure_url) {
    throw new Error(json?.error?.message || "Image upload failed. Please try again.");
  }
  return { secure_url: json.secure_url, public_id: json.public_id };
}
