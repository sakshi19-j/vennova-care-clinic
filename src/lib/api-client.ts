// Lightweight API client for the Vennova Clinic backend (FastAPI on Railway).
//
// Centralized auth-aware fetch:
// - Awaits the Supabase session before each request and attaches the bearer.
// - Retries once on 401/403 after refreshing the session.
// - Coalesces parallel refresh calls so polling never spawns a refresh storm.
// - Adds a request timeout (default 20s) and surfaces clean, human messages.
// - Never clears the user's session on transient network failures.

import { supabase } from "@/integrations/supabase/client";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiRequestOptions {
  /** Extra headers merged on top of defaults. */
  headers?: Record<string, string>;
  /** Query string params for GET-style calls. */
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Skip attaching the Supabase bearer token (rare). */
  skipAuth?: boolean;
  /** Pass-through AbortSignal. */
  signal?: AbortSignal;
  /** Override the default request timeout in ms (default 20000). */
  timeoutMs?: number;
  /** Internal: disable auto-retry on 401/403. */
  _noRetry?: boolean;
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

const DEFAULT_TIMEOUT_MS = 20000;

function getBaseUrl(): string {
  const url = import.meta.env.VITE_API_URL as string | undefined;
  if (!url) {
    throw new Error(
      "Backend URL is not configured. Please contact support.",
    );
  }
  return url.replace(/\/+$/, "");
}

// One-shot startup log so we can confirm the active API base + origin in the browser.
if (typeof window !== "undefined") {
  const w = window as unknown as { __vennovaApiLogged?: boolean };
  if (!w.__vennovaApiLogged) {
    w.__vennovaApiLogged = true;
    // eslint-disable-next-line no-console
    console.info(
      "[Vennova] API URL:",
      (import.meta.env.VITE_API_URL as string) || "(unset)",
      "| Origin:",
      window.location.origin,
    );
  }
}

function buildUrl(path: string, query?: ApiRequestOptions["query"]): string {
  const base = getBaseUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${cleanPath}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

// ---------- Session / refresh dedupe ----------

let refreshInFlight: Promise<string | null> | null = null;

async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

// True when Supabase has a persisted session in storage but has not finished
// rehydrating it yet. Used to avoid firing authed requests token-less on the
// very first render after a reload / right after sign-in.
function hasPersistedSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) return true;
    }
  } catch {
    /* storage blocked */
  }
  return false;
}

// Waits (briefly) for the session token to become available instead of racing
// ahead of Supabase's rehydration and getting a 401 "Missing authorization
// token". Returns immediately when a token is already there, and does not wait
// at all when the user is genuinely signed out.
const AUTH_WAIT_MS = 4000;
async function waitForAccessToken(): Promise<string | null> {
  let token = await getAccessToken();
  if (token) return token;
  if (!hasPersistedSession()) return null;

  const deadline = Date.now() + AUTH_WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 120));
    token = await getAccessToken();
    if (token) return token;
    if (!hasPersistedSession()) return null;
  }
  return null;
}


async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) return null;
      return data.session?.access_token ?? null;
    } catch {
      return null;
    } finally {
      // Allow subsequent refreshes after this one settles.
      setTimeout(() => {
        refreshInFlight = null;
      }, 0);
    }
  })();
  return refreshInFlight;
}

async function authHeader(): Promise<Record<string, string>> {
  const token = await waitForAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}


// ---------- Fetch with timeout ----------

function withTimeout(
  signal: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException("Request timed out", "TimeoutError")), timeoutMs);
  const onAbort = () => ctrl.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) ctrl.abort(signal.reason);
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  return {
    signal: ctrl.signal,
    cleanup: () => {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onAbort);
    },
  };
}

// ---------- Error parsing ----------

// Walk a FastAPI validation error array into a readable, field-aware string.
function formatValidationDetail(detail: unknown[]): string | null {
  const parts: string[] = [];
  for (const item of detail) {
    if (!item || typeof item !== "object") continue;
    const o = item as { msg?: unknown; loc?: unknown; type?: unknown };
    const msg = typeof o.msg === "string" ? o.msg : "";
    const loc = Array.isArray(o.loc)
      ? o.loc.filter((s) => s !== "body" && typeof s !== "number").join(".")
      : "";
    if (loc && msg) parts.push(`${loc}: ${msg}`);
    else if (msg) parts.push(msg);
  }
  return parts.length ? parts.join("; ") : null;
}

function parseErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const detail = obj.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const v = formatValidationDetail(detail);
      if (v) return v;
    }
    if (typeof obj.message === "string" && obj.message.trim()) return obj.message;
    if (typeof obj.error === "string" && obj.error.trim()) return obj.error;
  }
  if (typeof payload === "string" && payload.trim()) return payload;
  if (status === 401) return "Your session expired. Please sign in again.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "Not found.";
  if (status === 408 || status === 504) return "The server took too long to respond. Please retry.";
  if (status === 409) return "Conflicting request — that record may already exist.";
  if (status === 422) return "The data sent is invalid.";
  if (status === 429) return "Too many requests — slow down and retry.";
  if (status >= 500) return `Backend error (${status}). Please retry in a moment.`;
  return `Request failed (${status}).`;
}

function networkErrorMessage(e: unknown): string {
  const err = e as { name?: string; message?: string } | null;
  if (!err) return "Could not reach the server. Please check your connection.";
  if (err.name === "AbortError") return "Request cancelled.";
  if (err.name === "TimeoutError") return "The request timed out. Please retry.";
  const msg = err.message || "";
  if (/Failed to fetch|NetworkError|network/i.test(msg)) {
    return "Couldn't reach the server. Please check your connection and retry.";
  }
  return msg || "Could not reach the server.";
}

// ---------- Core request ----------

async function request<T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  options: ApiRequestOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { signal, cleanup } = withTimeout(options.signal, timeoutMs);

  let res: Response;
  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(options.skipAuth ? {} : await authHeader()),
      ...(options.headers ?? {}),
    };

    res = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (e) {
    cleanup();
    // Re-throw caller aborts unchanged so React Query can swallow them silently.
    if ((e as { name?: string })?.name === "AbortError" && options.signal?.aborted) {
      throw e;
    }
    throw new ApiError(networkErrorMessage(e), 0, null);
  }
  cleanup();

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson
    ? await res.json().catch(() => null)
    : await res.text().catch(() => "");

  if (!res.ok) {
    // Verbose, single-line diagnostic for the dev console. Includes the
    // resolved URL, status, and the parsed body so backend validation
    // failures (FastAPI 422) are immediately visible without DevTools
    // network inspection.
    try {
      // eslint-disable-next-line no-console
      console.error(
        `[Vennova API ${res.status}]`,
        method,
        buildUrl(path, options.query),
        payload,
      );
    } catch {
      /* noop */
    }
    // Retry once on auth failure after refreshing the token.
    if ((res.status === 401 || res.status === 403) && !options.skipAuth && !options._noRetry) {
      const fresh = await refreshAccessToken();
      if (fresh) {
        return request<T>(method, path, body, { ...options, _noRetry: true });
      }
    }
    throw new ApiError(parseErrorMessage(payload, res.status), res.status, payload);
  }

  return payload as T;
}

export async function getBlob(
  path: string,
  options: ApiRequestOptions = {},
): Promise<Blob> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { signal, cleanup } = withTimeout(options.signal, timeoutMs);

  let res: Response;
  try {
    const headers: Record<string, string> = {
      ...(options.skipAuth ? {} : await authHeader()),
      ...(options.headers ?? {}),
    };

    res = await fetch(buildUrl(path, options.query), {
      method: "GET",
      headers,
      signal,
    });
  } catch (e) {
    cleanup();
    throw new ApiError(networkErrorMessage(e), 0, null);
  }
  cleanup();

  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && !options.skipAuth && !options._noRetry) {
      const fresh = await refreshAccessToken();
      if (fresh) {
        return getBlob(path, { ...options, _noRetry: true });
      }
    }
    const text = await res.text().catch(() => "");
    throw new ApiError(parseErrorMessage(text, res.status), res.status, text);
  }

  return res.blob();
}

export const api = {
  get: <T>(path: string, options?: ApiRequestOptions) =>
    request<T>("GET", path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>("POST", path, body, options),
  put: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>("PUT", path, body, options),
  patch: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>("PATCH", path, body, options),
  delete: <T>(path: string, options?: ApiRequestOptions) =>
    request<T>("DELETE", path, undefined, options),
  getBlob,
};

/** Reminders API. */
export const remindersApi = {
  listToday: <T>(options?: ApiRequestOptions) =>
    api.get<T>("/reminders/today", options),
  send: <T = unknown>(followupId: string, options?: ApiRequestOptions) =>
    api.post<T>(
      `/reminders/${encodeURIComponent(followupId)}/send`,
      undefined,
      options,
    ),
};

export default api;
