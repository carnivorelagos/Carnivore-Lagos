export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED";

export type FulfillmentType = "PICKUP" | "DELIVERY";

/**
 * Explicit allow-list (Section 9) — no arbitrary status strings, no
 * reverse transitions. PAID is reachable only via the payment
 * verify/webhook path (see payments.ts), never via this admin-facing
 * transition function, which is why it's absent as a target here.
 *
 * The READY leg is fulfillment-aware: a DELIVERY order goes
 * READY → OUT_FOR_DELIVERY → DELIVERED; a PICKUP order goes
 * READY → COMPLETED. `allowedNextStatuses` filters on that.
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["CANCELLED"],
  PAID: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY"],
  READY: ["OUT_FOR_DELIVERY", "COMPLETED"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  COMPLETED: [],
  CANCELLED: [],
};

function filterByFulfillment(from: OrderStatus, targets: OrderStatus[], fulfillment?: FulfillmentType): OrderStatus[] {
  if (from !== "READY" || !fulfillment) return targets;
  return fulfillment === "DELIVERY"
    ? targets.filter((s) => s !== "COMPLETED")
    : targets.filter((s) => s !== "OUT_FOR_DELIVERY");
}

export function isValidTransition(from: OrderStatus, to: OrderStatus, fulfillment?: FulfillmentType): boolean {
  return filterByFulfillment(from, ALLOWED_TRANSITIONS[from] ?? [], fulfillment).includes(to);
}

export function allowedNextStatuses(from: OrderStatus, fulfillment?: FulfillmentType): OrderStatus[] {
  return filterByFulfillment(from, ALLOWED_TRANSITIONS[from] ?? [], fulfillment);
}

/** Statuses at which no further transition is possible. */
export const TERMINAL_STATUSES: readonly OrderStatus[] = ["DELIVERED", "COMPLETED", "CANCELLED"];

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}
