import type { FulfillmentType, OrderStatus, PaymentStatus } from "./types";

/**
 * Display formatting only. All money is integer kobo end to end (never a
 * float); this converts to Naira for humans exactly like the backend's
 * src/lib/money.ts formatNaira.
 */
const nairaWhole = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const nairaKobo = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatNaira(kobo: number): string {
  if (!Number.isFinite(kobo)) return "₦0";
  return kobo % 100 === 0 ? nairaWhole.format(kobo / 100) : nairaKobo.format(kobo / 100);
}

/** Naira number for a numeric <input> (kobo -> e.g. 8000, 4500.5). */
export function koboToNairaInput(kobo: number): string {
  return String(Math.round(kobo) / 100);
}

/** Parse a Naira text field to integer kobo. Returns null if not valid. */
export function nairaInputToKobo(value: string): number | null {
  const trimmed = value.trim().replace(/[₦,\s]/g, "");
  if (trimmed === "" || !/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  return Math.round(parseFloat(trimmed) * 100);
}

const dateTimeFmt = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const dateFmt = new Intl.DateTimeFormat("en-NG", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return Number.isNaN(d.getTime()) ? "-" : dateTimeFmt.format(d);
}

export function formatDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return Number.isNaN(d.getTime()) ? "-" : dateFmt.format(d);
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

/**
 * The backend's phoneSchema accepts `+234XXXXXXXXXX` or local
 * `0XXXXXXXXXX`, stripping spaces/dashes. We keep the user's chosen
 * format and only strip separators - no reformatting that could change
 * meaning.
 */
export function cleanPhone(input: string): string {
  return input.replace(/[\s-]/g, "").trim();
}

export function isLikelyNigerianPhone(input: string): boolean {
  return /^(?:\+234\d{10}|0\d{10})$/.test(cleanPhone(input));
}

// --- Domain label maps -------------------------------------------------

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Payment received",
  CONFIRMED: "Confirmed",
  PREPARING: "Being prepared",
  READY: "Ready",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/** Tone drives the badge treatment; never the only signal (Section 25). */
export const ORDER_STATUS_TONE: Record<
  OrderStatus,
  "pending" | "progress" | "positive" | "done" | "cancelled"
> = {
  PENDING_PAYMENT: "pending",
  PAID: "positive",
  CONFIRMED: "progress",
  PREPARING: "progress",
  READY: "positive",
  OUT_FOR_DELIVERY: "progress",
  DELIVERED: "done",
  COMPLETED: "done",
  CANCELLED: "cancelled",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: "Payment pending",
  SUCCESS: "Paid",
  FAILED: "Payment failed",
};

export const FULFILLMENT_LABEL: Record<FulfillmentType, string> = {
  PICKUP: "Pickup",
  DELIVERY: "Delivery",
};

/** Ordered lifecycle for the customer-facing tracker (excludes CANCELLED). */
export const ORDER_TIMELINE: OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "COMPLETED",
];

const PICKUP_TIMELINE: OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "COMPLETED",
];

const DELIVERY_TIMELINE: OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

/** The lifecycle steps shown to the customer, branched by fulfilment. */
export function orderTimelineFor(fulfillmentType: FulfillmentType): OrderStatus[] {
  return fulfillmentType === "DELIVERY" ? DELIVERY_TIMELINE : PICKUP_TIMELINE;
}
