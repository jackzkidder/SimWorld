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

async function doFetch<T = unknown>(
  url: string,
  init: RequestInit | undefined,
  timeoutMs: number
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
    const isAbort = err instanceof DOMException && err.name === "AbortError";
    const isNetwork = err instanceof TypeError;
    const message = isAbort
      ? "Request timed out"
      : isNetwork
      ? "Cannot reach server"
      : String(err);
    return {
      ok: false,
      data: null,
      error: message,
      status: isAbort ? -1 : isNetwork ? -2 : 0,
    };
  }
}

async function safeFetch<T = unknown>(
  url: string,
  init?: RequestInit,
  // 45s per attempt covers Fly.io cold starts (machine boot ~20-30s).
  timeoutMs = 45000
): Promise<ApiResult<T>> {
  // Retry once on timeout or network error (covers cold-start + transient DNS).
  // Backend is idempotent for reads; for POSTs the first attempt may have reached
  // the server, but returning a network error is preferable to a silent miss —
  // and practical testing shows Fly boots cleanly on retry.
  let result = await doFetch<T>(url, init, timeoutMs);
  if (!result.ok && (result.status === -1 || result.status === -2)) {
    // Trigger a parallel warm-up ping to hasten machine boot, then retry.
    void fetch(`${API_BASE_URL}/health`, { method: "GET" }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));
    result = await doFetch<T>(url, init, timeoutMs);
    if (!result.ok && result.status < 0) {
      // Normalize retry-exhausted errors for the UI.
      result.error =
        result.status === -1
          ? "Server is waking up — please try again in a few seconds."
          : "Cannot reach server. Check your internet connection and try again.";
      result.status = 0;
    }
  }
  return result;
}

/** Fire-and-forget warm-up ping. Called at app launch to pre-boot Fly machine. */
export function warmBackend(): void {
  if (typeof window === "undefined") return;
  void fetch(`${API_BASE_URL}/health`, { method: "GET" }).catch(() => {});
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
