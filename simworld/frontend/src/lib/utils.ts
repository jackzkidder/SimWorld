import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://simworld-api.fly.dev";

/* ── Resilient API helpers ─────────────────────────────────
   All calls catch network errors and return a typed result
   so consumers never need to worry about crashes.
   ───────────────────────────────────────────────────────── */

export interface ApiResult<T = unknown> {
  ok: boolean;
  data: T | null;
  error: string | null;
  status: number;
}

async function safeFetch<T = unknown>(
  url: string,
  init?: RequestInit,
  timeoutMs = 15000
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      let errorMsg = `API error ${res.status}`;
      try {
        const body = await res.json();
        if (body.detail) errorMsg = String(body.detail);
      } catch {
        /* ignore parse failure */
      }
      return { ok: false, data: null, error: errorMsg, status: res.status };
    }

    const data = (await res.json()) as T;
    return { ok: true, data, error: null, status: res.status };
  } catch (err) {
    clearTimeout(timer);
    const message =
      err instanceof DOMException && err.name === "AbortError"
        ? "Request timed out"
        : err instanceof TypeError
        ? "Cannot reach server"
        : String(err);
    return { ok: false, data: null, error: message, status: 0 };
  }
}

export function apiGet<T = unknown>(path: string): Promise<ApiResult<T>> {
  return safeFetch<T>(`${API_BASE_URL}${path}`);
}

export function apiPost<T = unknown>(
  path: string,
  body?: unknown
): Promise<ApiResult<T>> {
  return safeFetch<T>(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiPostForm<T = unknown>(
  path: string,
  formData: FormData
): Promise<ApiResult<T>> {
  return safeFetch<T>(`${API_BASE_URL}${path}`, {
    method: "POST",
    body: formData,
  });
}
