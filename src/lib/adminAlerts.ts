import { formatNaira } from "./money";
import { sendWebPushToAdmins } from "./webPush";
import { logger } from "./logger";

/**
 * Real-time kitchen alerts. Fired from applyPaystackOutcome the moment a
 * payment is confirmed — the one point where an order becomes something
 * the kitchen must act on. Best-effort: a delivery failure is logged and
 * swallowed, never allowed to affect the payment result.
 */
export async function alertAdminsPaidOrder(order: {
  id: string;
  orderNumber: string;
  fulfillmentType: string;
  totalKobo: number;
  customerName: string;
}): Promise<void> {
  try {
    await sendWebPushToAdmins({
      title: "New paid order",
      body: `${order.orderNumber} · ${formatNaira(order.totalKobo)} · ${
        order.fulfillmentType === "DELIVERY" ? "Delivery" : "Pickup"
      } · ${order.customerName}`,
      url: `/admin/orders/${order.id}`,
      tag: `admin-order-${order.id}`,
    });
  } catch (err) {
    logger.error("admin_alert_failed", {
      orderId: order.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
