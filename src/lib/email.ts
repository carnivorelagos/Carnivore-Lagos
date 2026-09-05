import { logger } from "./logger";
import { formatNaira } from "./money";

/**
 * Email delivery, behind one interface — same pattern as sms.ts. Swapping
 * in a real provider (Resend, Postmark, SES, ...) is a one-file change:
 * implement EmailProvider, return it from getEmailProvider().
 */
export interface EmailProvider {
  send(params: { to: string; subject: string; html: string; text: string }): Promise<void>;
}

/**
 * Dev-only fallback — logs the email instead of sending it. Same
 * production guard as ConsoleSmsProvider and for the same reason: a
 * live site with no real email provider configured should fail loudly
 * the first time it tries to send, not silently drop every verification
 * code and receipt into function logs.
 */
class ConsoleEmailProvider implements EmailProvider {
  async send(params: { to: string; subject: string; html: string; text: string }): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "No real email provider is configured (EMAIL_PROVIDER env var), and the console fallback " +
          "refuses to run in production. Set EMAIL_PROVIDER once a provider is chosen.",
      );
    }
    logger.info("email_send_dev_console_only", { to: params.to, subject: params.subject, text: params.text });
  }
}

let cached: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (cached) return cached;
  const providerName = process.env.EMAIL_PROVIDER;
  switch (providerName) {
    // Add a real case here once a provider is chosen, e.g.:
    // case "resend": cached = new ResendEmailProvider(); break;
    default:
      cached = new ConsoleEmailProvider();
  }
  return cached;
}

const APP_NAME = "Carnivore Lagos";
const FROM_LABEL = `${APP_NAME} <no-reply@carnivorelagos.example>`; // replace with the real sending domain once one is chosen

export async function sendEmailVerificationCode(email: string, code: string): Promise<void> {
  await getEmailProvider().send({
    to: email,
    subject: `Your ${APP_NAME} verification code`,
    text: `Your verification code is ${code}. It expires in 5 minutes. Never share this code.`,
    html: `<p>Your verification code is <strong>${code}</strong>. It expires in 5 minutes.</p><p>Never share this code with anyone.</p>`,
  });
}

export type ReceiptOrder = {
  orderNumber: string;
  fulfillmentType: string;
  customerName: string;
  items: { productNameSnapshot: string; quantity: number; unitPriceKobo: number; lineTotalKobo: number }[];
  subtotalKobo: number;
  deliveryFeeKobo: number;
  totalKobo: number;
};

/**
 * Fired exactly once per successful payment, from applyPaystackOutcome —
 * the same function both the verify route and the webhook already share,
 * so this inherits that function's existing idempotency for free (a
 * payment that's already SUCCESS is a no-op there, so this never fires
 * twice for one order).
 */
export async function sendReceiptEmail(to: string, order: ReceiptOrder): Promise<void> {
  const rows = order.items
    .map(
      (i) =>
        `<tr><td>${escapeHtml(i.productNameSnapshot)} × ${i.quantity}</td><td style="text-align:right">${formatNaira(i.lineTotalKobo)}</td></tr>`,
    )
    .join("");
  const textRows = order.items
    .map((i) => `  ${i.productNameSnapshot} × ${i.quantity} — ${formatNaira(i.lineTotalKobo)}`)
    .join("\n");

  const html = `
    <h2>Thanks for your order, ${escapeHtml(order.customerName)}!</h2>
    <p>Order <strong>${order.orderNumber}</strong> — ${order.fulfillmentType === "DELIVERY" ? "delivery" : "pickup"}</p>
    <table style="width:100%;border-collapse:collapse">${rows}</table>
    <p>Subtotal: ${formatNaira(order.subtotalKobo)}<br>
    Delivery: ${formatNaira(order.deliveryFeeKobo)}<br>
    <strong>Total: ${formatNaira(order.totalKobo)}</strong></p>
  `;
  const text = `Thanks for your order, ${order.customerName}!\nOrder ${order.orderNumber} — ${order.fulfillmentType}\n\n${textRows}\n\nSubtotal: ${formatNaira(order.subtotalKobo)}\nDelivery: ${formatNaira(order.deliveryFeeKobo)}\nTotal: ${formatNaira(order.totalKobo)}`;

  await getEmailProvider().send({
    to,
    subject: `Your ${APP_NAME} order ${order.orderNumber}`,
    html,
    text,
  });
}

/**
 * Order-status update email. Plain and short — one headline line plus a
 * link back to the order. Called only for the transitions that route to
 * email in src/lib/notifications.ts.
 */
export async function sendOrderStatusEmail(
  to: string,
  params: { orderNumber: string; heading: string; message: string; url?: string; customerName?: string },
): Promise<void> {
  const greeting = params.customerName ? `Hi ${escapeHtml(params.customerName)},` : "Hi,";
  const link = params.url
    ? `<p><a href="${escapeHtml(params.url)}">View your order</a></p>`
    : "";
  const html = `
    <p>${greeting}</p>
    <h2 style="margin:0 0 8px">${escapeHtml(params.heading)}</h2>
    <p>${escapeHtml(params.message)}</p>
    <p style="color:#666">Order <strong>${escapeHtml(params.orderNumber)}</strong></p>
    ${link}
  `;
  const text = `${greeting}\n\n${params.heading}\n${params.message}\n\nOrder ${params.orderNumber}${params.url ? `\n${params.url}` : ""}`;

  await getEmailProvider().send({
    to,
    subject: `${APP_NAME} order ${params.orderNumber} — ${params.heading}`,
    html,
    text,
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export { FROM_LABEL };
