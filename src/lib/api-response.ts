import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, ErrorCode } from "./errors";
import { logger } from "./logger";

/** Section 34's success shape. */
export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

/** Section 34's error shape. */
function fail(code: string, message: string, status: number, details?: unknown): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message, ...(details !== undefined ? { details } : {}) } },
    { status },
  );
}

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<NextResponse>;

/**
 * Wraps every route handler so error handling is uniform everywhere
 * (Section 34) rather than re-implemented per route:
 *  - AppError → its own code/status/message, safe to show the client.
 *  - ZodError → VALIDATION_ERROR with field-level details, never a raw
 *    Zod stack trace.
 *  - anything else (a Prisma error, a bug) → logged with full detail
 *    server-side, rendered to the client as an opaque INTERNAL_ERROR.
 *    No SQL, no Prisma error text, no stack trace ever reaches the client.
 */
export function withApiHandler(handler: Handler): Handler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof AppError) {
        if (err.status >= 500) {
          logger.error("app_error", { code: err.code, message: err.message });
        }
        return fail(err.code, err.message, err.status, err.details);
      }
      if (err instanceof ZodError) {
        return fail(
          ErrorCode.VALIDATION_ERROR,
          "Request failed validation.",
          400,
          err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        );
      }
      logger.error("unhandled_error", {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      return fail(ErrorCode.INTERNAL_ERROR, "Something went wrong. Please try again.", 500);
    }
  };
}
