// Lightweight API client for the Vennova Clinic backend (FastAPI on Railway).
//
// - Reads base URL from VITE_API_URL
// - Automatically attaches the current Supabase session's bearer token
// - JSON in / JSON out
// - Never touches service_role or any server secret
//
// Usage:
//   import { api } from "@/lib/api-client";
//   const patients = await api.get<Patient[]>("/patients");
//   await api.post("/appointments", { patient_id, slot_at });

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

function getBaseUrl(): string {
  const url = import.meta.env.VITE_API_URL as string | undefined;
  if (!url) {
    throw new Error(
      "VITE_API_URL is not set. Define it in your environment to call the backend.",
    );
  }
  return url.replace(/\/+$/, "");
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

async function authHeader(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function request<T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  options: ApiRequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(options.skipAuth ? {} : await authHeader()),
    ...(options.headers ?? {}),
  };

  const res = await fetch(buildUrl(path, options.query), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: options.signal,
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload = isJson
    ? await res.json().catch(() => null)
    : await res.text().catch(() => "");

  if (!res.ok) {
    const message =
      (isJson && payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message: unknown }).message)
        : null) ?? `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status, payload);
  }

  return payload as T;
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
};

/** Reminders API. The backend exposes:
 *   GET  /reminders/today
 *   POST /reminders/{followup_id}/send
 */
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
