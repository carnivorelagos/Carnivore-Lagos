import { logger } from "./logger";

/**
 * SMS delivery, behind one interface — swapping in a real provider
 * (Termii, Africa's Talking, Twilio, ...) once one is chosen is a
 * one-file change: implement SmsProvider, return it from
 * getSmsProvider() instead of the console fallback. Nothing outside
 * this file needs to change.
 */
export interface SmsProvider {
  send(params: { to: string; body: string }): Promise<void>;
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

let cached: SmsProvider | null = null;

export function getSmsProvider(): SmsProvider {
  if (cached) return cached;
  const providerName = process.env.SMS_PROVIDER;
  switch (providerName) {
    // Add a real case here once a provider is chosen, e.g.:
    // case "termii": cached = new TermiiSmsProvider(); break;
    // case "africastalking": cached = new AfricasTalkingSmsProvider(); break;
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
