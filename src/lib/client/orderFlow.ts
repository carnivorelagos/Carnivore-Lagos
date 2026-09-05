import type { FulfillmentType, OrderStatus } from "./types";

/**
 * Client-side mirror of src/lib/orderStateMachine.ts (the backend is
 * still the enforcer - this only drives which transition buttons to
 * show in admin, Section 33). PAID is never a manual target; it's
 * reached only via the payment verify/webhook path.
 *
 * The READY leg is fulfilment-aware: DELIVERY orders go
 * READY -> OUT_FOR_DELIVERY -> DELIVERED, PICKUP orders go READY -> COMPLETED.
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

/** Statuses at which the order lifecycle is over (no polling needed). */
export const TERMINAL_STATUSES: readonly OrderStatus[] = ["DELIVERED", "COMPLETED", "CANCELLED"];

export function isTerminalStatus(s: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(s);
}

export function allowedNextStatuses(from: OrderStatus, fulfillment?: FulfillmentType): OrderStatus[] {
  const targets = ALLOWED_TRANSITIONS[from] ?? [];
  if (from !== "READY" || !fulfillment) return targets;
  return fulfillment === "DELIVERY"
    ? targets.filter((s) => s !== "COMPLETED")
    : targets.filter((s) => s !== "OUT_FOR_DELIVERY");
}

/** Verb for the action button, e.g. CONFIRMED -> "Mark confirmed". */
export const TRANSITION_VERB: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Reopen",
  PAID: "Mark paid",
  CONFIRMED: "Confirm order",
  PREPARING: "Start preparing",
  READY: "Mark ready",
  OUT_FOR_DELIVERY: "Send out for delivery",
  DELIVERED: "Mark delivered",
  COMPLETED: "Complete order",
  CANCELLED: "Cancel order",
};
