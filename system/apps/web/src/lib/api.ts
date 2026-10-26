import type { ApiError as ApiErrorBody } from "@proofpocket/shared";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

/**
 * Where the API is. Empty in development (Vite proxies /api). In production the API runs on Cloud Run in
 * africa-south1, which Firebase Hosting can't route to, so the web app calls it directly (CORS allows only our site).
 */
export const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

let tokenGetter: () => Promise<string | null> = async () => null;
/** The auth provider registers how to get the current ID token. */
export const setTokenGetter = (fn: () => Promise<string | null>) => { tokenGetter = fn; };

let onUnauthorized: () => void = () => {};
/** Called when the API says the sign-in is no longer valid (expired or revoked). */
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export async function api<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal; headers?: Record<string, string> } = {}): Promise<T> {
  const token = await tokenGetter();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1${path}`, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: {
        Accept: "application/json",
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal,
    });
  } catch {
    throw new ApiError(0, "offline", "You're offline. Check your connection and try again.");
  }
  if (res.ok) return (res.status === 204 ? undefined : await res.json()) as T;
  let body: Partial<ApiErrorBody> = {};
  try { body = await res.json(); } catch { /* not JSON */ }
  if (res.status === 401 && token && body.error?.code === "invalid_token") onUnauthorized();
  throw new ApiError(res.status, body.error?.code ?? "http_error", body.error?.message ?? "Something went wrong. Try again.");
}

/** A file from the API (e.g. a diagram's source), with the same sign-in as api(). */
export async function apiBlob(path: string): Promise<Blob> {
  const token = await tokenGetter();
  const res = await fetch(`${API_BASE}/api/v1${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new ApiError(res.status, "http_error", res.status === 403 ? "You don't have access to this file." : "Couldn't download the file. Try again.");
  return res.blob();
}
