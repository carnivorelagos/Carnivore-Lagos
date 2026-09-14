import { logger } from "./logger";

/**
 * SMS delivery, behind one interface — swapping in a real provider
 * (Termii, Africa's Talking, Twilio, ...) once one is chosen is a
 * one-file change: implement SmsProvider, return it from
 * getSmsProvider() instead of the console fallback. Nothing outside
 * this file needs to change.
 *
 * Selection is driven by SMS_PROVIDER — swap providers with one env var,
 * no code change (a Termii → Sendchamp fallback, or the reverse, is just
 * `SMS_PROVIDER=` + that provider's keys):
 *   unset / anything else → ConsoleSmsProvider  (dev only, hard-stops in prod)
 *   "sendchamp"           → SendchampSmsProvider (SENDCHAMP_ACCESS_KEY, SENDCHAMP_SENDER_NAME)
 *   "termii"              → TermiiSmsProvider    (TERMII_API_KEY, TERMII_SENDER_ID)
 */
export interface SmsProvider {
  send(params: { to: string; body: string }): Promise<void>;
}

/**
 * `fetch()` network failures surface as a bare `TypeError: fetch failed`;
 * the useful detail (ENOTFOUND, ECONNREFUSED, UND_ERR_CONNECT_TIMEOUT,
 * cert errors, invalid header) lives on `err.cause`. Pull it out for logs.
 */
function describeFetchError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = (err as { cause?: unknown }).cause;
  if (cause instanceof Error) return `${err.message}: ${cause.message}`;
  if (cause && typeof cause === "object" && "code" in cause) {
    return `${err.message}: ${String((cause as { code?: unknown }).code)}`;
  }
  return err.message;
}

/**
 * Dev-only fallback — logs the message instead of sending it. This is
 * how OTP codes are "delivered" in local development and in this
 * sandbox, where no real SMS provider is configured.
 *
 * Deliberately refuses to run in production (mirrors the seed script's
 * NODE_ENV guard, Section 23's "hard stop, not a guess" principle): a
 * real restaurant going live with no SMS provider wired in would
 * otherwise silently "work" by printing OTP codes into Netlify function
 * logs instead of texting them to customers — a launch bug that would
 * be very easy to miss and very bad to ship.
 */
class ConsoleSmsProvider implements SmsProvider {
  async send(params: { to: string; body: string }): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "No real SMS provider is configured (SMS_PROVIDER env var), and the console fallback " +
          "refuses to run in production. Set SMS_PROVIDER once a provider is chosen.",
      );
    }
    logger.info("sms_send_dev_console_only", { to: params.to, body: params.body });
  }
}

/**
 * Termii (https://termii.com) plain-SMS send over its REST API — no SDK
 * dependency, same reasoning as paystack.ts / the Resend provider in
 * email.ts. This app generates and verifies its own OTP codes
 * (src/lib/otp.ts), so this uses Termii's dumb "send this text" endpoint
 * (`/api/sms/send`), NOT Termii's Token API. Needs:
 *   TERMII_API_KEY   — from the Termii dashboard.
 *   TERMII_SENDER_ID — a sender ID registered/approved on that account.
 *   TERMII_CHANNEL   — optional: "generic" (default), "dnd", or "whatsapp".
 *                      Use "dnd" if OTPs don't reach numbers with the
 *                      carrier Do-Not-Disturb list active (common in NG).
 *   TERMII_BASE_URL  — optional override; defaults to https://v3.api.termii.com
 *                      (some accounts are provisioned on api.ng.termii.com).
 */
class TermiiSmsProvider implements SmsProvider {
  private readonly apiKey: string;
  private readonly senderId: string;
  private readonly channel: string;
  private readonly baseUrl: string;

  constructor() {
    const apiKey = process.env.TERMII_API_KEY;
    const senderId = process.env.TERMII_SENDER_ID;
    if (!apiKey || !senderId) {
      throw new Error(
        'SMS_PROVIDER="termii" but TERMII_API_KEY and/or TERMII_SENDER_ID is not set.',
      );
    }
    this.apiKey = apiKey;
    this.senderId = senderId;
    this.channel = process.env.TERMII_CHANNEL?.trim() || "generic";
    this.baseUrl = (process.env.TERMII_BASE_URL?.trim() || "https://v3.api.termii.com").replace(/\/+$/, "");
  }

  async send(params: { to: string; body: string }): Promise<void> {
    const to = toInternationalMsisdn(params.to);

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/sms/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          from: this.senderId,
          sms: params.body,
          type: "plain",
          channel: this.channel,
          api_key: this.apiKey,
        }),
      });
    } catch (err) {
      logger.error("sms_send_failed", {
        provider: "termii",
        to,
        reason: "network",
        message: describeFetchError(err),
      });
      throw new Error("Could not reach the SMS provider.");
    }

    const payload = (await res.json().catch(() => null)) as
      | { message_id?: string; message?: string; code?: string | number; balance?: number }
      | null;

    // Termii signals some failures as HTTP 4xx and others as HTTP 200 with
    // a non-"Successfully Sent" message — treat both as failures.
    const sentOk =
      res.ok && typeof payload?.message === "string" && /success/i.test(payload.message);

    if (!sentOk) {
      logger.error("sms_send_failed", {
        provider: "termii",
        to,
        status: res.status,
        message: payload?.message ?? "unknown error",
        code: payload?.code,
      });
      throw new Error(`Termii rejected the SMS (${res.status}).`);
    }

    logger.info("sms_sent", { provider: "termii", to, id: payload?.message_id, balance: payload?.balance });
  }
}

/**
 * Sendchamp (https://sendchamp.com) SMS send over its REST API — no SDK
 * dependency, same shape as TermiiSmsProvider. The app owns its own OTP
 * codes (src/lib/otp.ts), so this hits the plain `/sms/send` endpoint,
 * not Sendchamp's Verification/OTP product. Needs:
 *   SENDCHAMP_ACCESS_KEY — the account access/API key, sent as a bearer
 *                          token ("public access key" in the dashboard).
 *   SENDCHAMP_SENDER_NAME — a Sender ID approved on that account. Sendchamp
 *                          also allows the shared "Sendchamp" sender for
 *                          first tests.
 *   SENDCHAMP_ROUTE      — optional: "dnd" (default), "non_dnd" or
 *                          "international". "dnd" reaches Nigerian numbers
 *                          with the carrier Do-Not-Disturb list active.
 *   SENDCHAMP_BASE_URL   — optional override; defaults to
 *                          https://api.sendchamp.com/api/v1
 */
class SendchampSmsProvider implements SmsProvider {
  private readonly accessKey: string;
  private readonly senderName: string;
  private readonly route: string;
  private readonly baseUrl: string;

  constructor() {
    const accessKey = process.env.SENDCHAMP_ACCESS_KEY;
    const senderName = process.env.SENDCHAMP_SENDER_NAME;
    if (!accessKey || !senderName) {
      throw new Error(
        'SMS_PROVIDER="sendchamp" but SENDCHAMP_ACCESS_KEY and/or SENDCHAMP_SENDER_NAME is not set.',
      );
    }
    this.accessKey = accessKey;
    this.senderName = senderName;
    this.route = process.env.SENDCHAMP_ROUTE?.trim() || "dnd";
    this.baseUrl = (process.env.SENDCHAMP_BASE_URL?.trim() || "https://api.sendchamp.com/api/v1").replace(
      /\/+$/,
      "",
    );
  }

  async send(params: { to: string; body: string }): Promise<void> {
    const to = toInternationalMsisdn(params.to);

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/sms/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          to: [to],
          message: params.body,
          sender_name: this.senderName,
          route: this.route,
        }),
      });
    } catch (err) {
      logger.error("sms_send_failed", {
        provider: "sendchamp",
        to,
        reason: "network",
        message: describeFetchError(err),
      });
      throw new Error("Could not reach the SMS provider.");
    }

    const payload = (await res.json().catch(() => null)) as
      | { status?: string; code?: string | number; message?: string; data?: { id?: string; status?: string } }
      | null;

    // Sendchamp reports some failures as HTTP 4xx and others as HTTP 200
    // with `status: "error"` — treat both as failures.
    const sentOk = res.ok && payload?.status === "success";

    if (!sentOk) {
      logger.error("sms_send_failed", {
        provider: "sendchamp",
        to,
        status: res.status,
        code: payload?.code,
        message: payload?.message ?? "unknown error",
      });
      throw new Error(`Sendchamp rejected the SMS (${res.status}).`);
    }

    logger.info("sms_sent", {
      provider: "sendchamp",
      to,
      id: payload?.data?.id,
      deliveryStatus: payload?.data?.status,
    });
  }
}

/**
 * Termii (and most gateways) want a bare international MSISDN: digits only,
 * country code included, no leading "+" or "0". The app's phoneSchema
 * accepts either `+234XXXXXXXXXX` or local `0XXXXXXXXXX`, so normalise both
 * to `234XXXXXXXXXX` here. Anything already in another shape is passed
 * through digits-only and left for the provider to reject.
 */
function toInternationalMsisdn(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return `234${digits.slice(1)}`;
  return digits;
}

let cached: SmsProvider | null = null;

export function getSmsProvider(): SmsProvider {
  if (cached) return cached;
  const providerName = process.env.SMS_PROVIDER;
  switch (providerName) {
    case "sendchamp":
      cached = new SendchampSmsProvider();
      break;
    case "termii":
      cached = new TermiiSmsProvider();
      break;
    default:
      cached = new ConsoleSmsProvider();
  }
  return cached;
}

const APP_NAME = "Carnivore Lagos";

export async function sendOtpSms(phone: string, code: string): Promise<void> {
  await getSmsProvider().send({
    to: phone,
    body: `${APP_NAME}: your verification code is ${code}. It expires in 5 minutes. Never share this code.`,
  });
}

/**
 * Order-status text. Kept short (one segment where possible) — SMS is
 * metered. Called only for the transitions that route to SMS in
 * src/lib/notifications.ts.
 */
export async function sendOrderStatusSms(
  phone: string,
  params: { orderNumber: string; message: string; url?: string },
): Promise<void> {
  const tail = params.url ? ` ${params.url}` : "";
  await getSmsProvider().send({
    to: phone,
    body: `${APP_NAME}: ${params.message} (order ${params.orderNumber})${tail}`,
  });
}
