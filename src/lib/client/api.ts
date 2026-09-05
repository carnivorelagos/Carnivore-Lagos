import type { ApiEnvelopeError } from "./types";

/**
 * The one place browser -> same-origin API calls go through. Everything
 * here runs in the browser (client components only): the backend's CSRF
 * layer (src/lib/auth/csrf.ts) checks the Origin header on every
 * mutating request, and only a real browser fetch sends it. Server
 * Components / Server Actions must never call this.
 */

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/** productIds flagged by a PRODUCT_UNAVAILABLE response, if present. */
export function unavailableProductIds(e: unknown): string[] {
  if (!isApiError(e) || e.code !== "PRODUCT_UNAVAILABLE") return [];
  const d = e.details as { productIds?: unknown } | undefined;
  return Array.isArray(d?.productIds) ? (d!.productIds as string[]) : [];
}

type Query = Record<string, string | number | boolean | null | undefined>;

export type ApiFetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  query?: Query;
};

function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, query, headers, method, ...rest } = options;
  const hasBody = body !== undefined;

  let res: Response;
  try {
    res = await fetch(withQuery(path, query), {
      ...rest,
      method: method ?? (hasBody ? "POST" : "GET"),
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: hasBody ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      "NETWORK",
      "Couldn't reach the server. Check your connection and try again.",
      0,
    );
  }

  // 204 / empty body - treat as null data.
  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  const envelope = json as
    | { success: true; data: T }
    | ApiEnvelopeError
    | null;

  if (!res.ok || !envelope || envelope.success === false) {
    const err = (envelope as ApiEnvelopeError | null)?.error;
    throw new ApiError(
      err?.code ?? "INTERNAL_ERROR",
      err?.message ?? "Something went wrong. Please try again.",
      res.status,
      err?.details,
    );
  }

  return envelope.data;
}

/**
 * Read helper with bounded retry for transient failures only (Section 42).
 * NEVER wrap a mutation in this.
 */
export async function apiRead<T>(
  path: string,
  options: ApiFetchOptions = {},
  retries = 2,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await apiFetch<T>(path, { ...options, method: "GET" });
    } catch (e) {
      lastErr = e;
      const transient =
        isApiError(e) && (e.status === 0 || e.status >= 500 || e.code === "NETWORK");
      if (!transient || attempt === retries) throw e;
      await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
    }
  }
  throw lastErr;
}
