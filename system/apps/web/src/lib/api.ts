import type { ApiError as ApiErrorBody } from "@proofpocket/shared";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

let tokenGetter: () => Promise<string | null> = async () => null;
/** The auth provider registers how to get the current ID token. */
export const setTokenGetter = (fn: () => Promise<string | null>) => { tokenGetter = fn; };

let onUnauthorized: () => void = () => {};
/** Called when the API says the sign-in is no longer valid (expired or revoked). */
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export async function api<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const token = await tokenGetter();
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: {
        Accept: "application/json",
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
