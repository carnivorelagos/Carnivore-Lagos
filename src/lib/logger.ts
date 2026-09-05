/**
 * Minimal structured logger (Section 35). Deliberately no external logging
 * service for MVP — writes structured JSON lines to stdout/stderr, which
 * Netlify captures as function logs. Swapping in a hosted log drain later
 * is a one-file change.
 *
 * Hard rule: never pass a password, password hash, AUTH_SECRET, Paystack
 * secret key, full card/payment payloads, or raw request bodies containing
 * those to this logger. Callers pass a plain, pre-shaped `fields` object;
 * this module does not introspect arbitrary objects for you, on purpose —
 * that forces every call site to consciously choose what's safe to log.
 */

type Level = "info" | "warn" | "error";

const REDACTED_KEYS = new Set([
  "password",
  "passwordHash",
  "authSecret",
  "secret",
  "secretKey",
  "paystackSecretKey",
  "token",
  "sessionToken",
]);

function scrub(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = REDACTED_KEYS.has(key) ? "[redacted]" : value;
  }
  return out;
}

function write(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const line = {
    ts: new Date().toISOString(),
    level,
    event,
    ...scrub(fields),
  };
  const out = JSON.stringify(line);
  if (level === "error") {
    console.error(out);
  } else if (level === "warn") {
    console.warn(out);
  } else {
    console.log(out);
  }
}

export const logger = {
  info: (event: string, fields?: Record<string, unknown>) => write("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => write("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => write("error", event, fields),
};
