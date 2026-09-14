import { logger } from "./logger";
import { formatNaira } from "./money";

/**
 * Email delivery, behind one interface — same pattern as sms.ts. Swapping
 * in a real provider (Resend, Postmark, SES, ...) is a one-file change:
 * implement EmailProvider, return it from getEmailProvider().
 *
 * Selection is driven by EMAIL_PROVIDER:
 *   unset / anything else → ConsoleEmailProvider (dev only, hard-stops in prod)
 *   "resend"              → ResendEmailProvider (needs RESEND_API_KEY, EMAIL_FROM)
 */
export interface EmailProvider {
  send(params: { to: string; subject: string; html: string; text: string }): Promise<void>;
}

const APP_NAME = "Carnivore Lagos";
// Sender identity. Set EMAIL_FROM to an address on a domain verified in
// your email provider (Resend, etc). Falls back to a placeholder that
// only works with the dev console provider.
const FROM_LABEL = process.env.EMAIL_FROM?.trim() || `${APP_NAME} <no-reply@carnivorelagos.example>`;

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

/**
 * Resend (https://resend.com) over its REST API — no SDK dependency, same
 * reasoning as paystack.ts: a plain `fetch` wrapper has nothing native to
 * bundle for Netlify Functions. Needs:
 *   RESEND_API_KEY — from the Resend dashboard (starts "re_").
 *   EMAIL_FROM     — a sender on a domain verified in that Resend account,
 *                    e.g. "Carnivore Lagos <orders@carnivorelagos.com>".
 *                    For testing before a domain is verified, Resend
 *                    accepts "onboarding@resend.dev" (delivers only to the
 *                    Resend account owner's address).
 */
class ResendEmailProvider implements EmailProvider {
  private readonly apiKey: string;

  constructor() {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error(
        'EMAIL_PROVIDER="resend" but RESEND_API_KEY is not set. Add it from the Resend dashboard.',
      );
    }
    this.apiKey = key;
  }

  async send(params: { to: string; subject: string; html: string; text: string }): Promise<void> {
    let res: Response;
    try {
      res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM_LABEL,
          to: [params.to],
          subject: params.subject,
          html: params.html,
          text: params.text,
        }),
      });
    } catch (err) {
      logger.error("email_send_failed", {
        provider: "resend",
        to: params.to,
        subject: params.subject,
        reason: "network",
        message: err instanceof Error ? err.message : String(err),
      });
      throw new Error("Could not reach the email provider.");
    }

    const body = (await res.json().catch(() => null)) as
      | { id?: string; message?: string; name?: string }
      | null;

    if (!res.ok) {
      logger.error("email_send_failed", {
        provider: "resend",
        to: params.to,
        subject: params.subject,
        status: res.status,
        message: body?.message ?? body?.name ?? "unknown error",
      });
      throw new Error(`Resend rejected the email (${res.status}).`);
    }

    logger.info("email_sent", { provider: "resend", to: params.to, subject: params.subject, id: body?.id });
  }
}

let cached: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (cached) return cached;
  const providerName = process.env.EMAIL_PROVIDER;
  switch (providerName) {
    case "resend":
      cached = new ResendEmailProvider();
      break;
    default:
      cached = new ConsoleEmailProvider();
  }
  return cached;
}

export async function sendEmailVerificationCode(email: string, code: string): Promise<void> {
  await getEmailProvider().send({
    to: email,
    subject: `Your ${APP_NAME} verification code`,
    text: `Your verification code is ${code}. It expires in 5 minutes. Never share this code.`,
    html: `<p>Your verification code is <strong>${code}</strong>. It expires in 5 minutes.</p><p>Never share this code with anyone.</p>`,
  });
}

/**
 * Security alert: fired on every successful admin sign-in, unconditionally
 * — this is deliberately noisy by design (an unexpected entry in a daily
 * digest is easy to miss; an email the moment it happens is not). Recipient
 * is a single configurable address, not the admin's own — the point is a
 * second pair of eyes on the account. A no-op if ADMIN_LOGIN_ALERT_EMAIL
 * isn't set, same as every other optional-provider feature in this app.
 */
export async function sendAdminLoginAlert(details: {
  adminEmail: string;
  role: string;
  ip: string;
  userAgent: string | null;
  at: Date;
}): Promise<void> {
  const to = process.env.ADMIN_LOGIN_ALERT_EMAIL?.trim();
  if (!to) return;

  const when = details.at.toISOString();
  const ua = details.userAgent ?? "unknown";
  await getEmailProvider().send({
    to,
    subject: `Admin sign-in: ${details.adminEmail}`,
    text:
      `${details.adminEmail} (${details.role}) signed in to the ${APP_NAME} admin dashboard.\n\n` +
      `Time: ${when}\nIP: ${details.ip}\nBrowser: ${ua}\n\n` +
      `If this wasn't you or your team, change the admin password immediately.`,
    html:
      `<p>${escapeHtml(details.adminEmail)} (${escapeHtml(details.role)}) signed in to the ${APP_NAME} admin dashboard.</p>` +
      `<table style="font-size:13px;color:#444"><tr><td style="padding-right:12px;color:#888">Time</td><td>${escapeHtml(when)}</td></tr>` +
      `<tr><td style="padding-right:12px;color:#888">IP</td><td>${escapeHtml(details.ip)}</td></tr>` +
      `<tr><td style="padding-right:12px;color:#888">Browser</td><td>${escapeHtml(ua)}</td></tr></table>` +
      `<p style="color:#666;font-size:13px">If this wasn't you or your team, change the admin password immediately.</p>`,
  });
}

/**
 * "Secure your order history" magic link (amendment 4). One tap after an
 * order: click the link, the address is verified, and this device's
 * history + saved card become recoverable from any device by re-verifying
 * the same email.
 */
export async function sendHistoryMagicLink(email: string, url: string): Promise<void> {
  await getEmailProvider().send({
    to: email,
    subject: `Confirm your email to keep your ${APP_NAME} order history`,
    text: `Tap this link to keep your order history safe: ${url}\n\nIt expires in 45 minutes. If you didn't order from ${APP_NAME}, ignore this email.`,
    html: `<p>Tap the button below to keep your ${APP_NAME} order history and saved card, recoverable from any device.</p>
<p><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;background:#e4231d;color:#fff;text-decoration:none;font-weight:600">Confirm my email</a></p>
<p style="color:#666;font-size:13px">This link expires in 45 minutes. If you didn't order from ${APP_NAME}, you can ignore this email.</p>`,
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
