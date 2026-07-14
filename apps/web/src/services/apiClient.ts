// Canonical API client (single source of truth for all backend calls).
//
// STATUS: opt-in. This app runs on seed data + localStorage by default (see
// ARCHITECTURE.md). Set `VITE_API_BASE_URL` to wire live endpoints — calendar
// and future flows use this client when configured.

// Base URL comes only from the environment; trailing slash normalized off.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

/** True only when a backend base URL is configured. Guards every call. */
export function isApiConfigured(): boolean {
  return API_BASE_URL.length > 0;
}

export interface ApiError extends Error {
  status?: number
  code?: string
  details?: unknown
}

function apiError(message: string, extra: Partial<ApiError> = {}): ApiError {
  return Object.assign(new Error(message), extra) as ApiError;
}

// Pluggable auth token provider. A real auth integration sets this; by default
// no token is sent. Tokens live wherever the provider keeps them (prefer an
// httpOnly cookie handled by the server over client-readable storage).
let tokenProvider: () => string | null = () => null;
export function setAuthTokenProvider(fn: () => string | null): void {
  tokenProvider = fn;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
  headers?: Record<string, string>
  signal?: AbortSignal
  timeoutMs?: number
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const p = path.startsWith('/') ? path : '/' + path;
  if (!query) return API_BASE_URL + p;
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
    .join('&');
  return API_BASE_URL + p + (qs ? '?' + qs : '');
}

/**
 * Perform a typed JSON request against the backend. Throws `ApiError` on a
 * non-2xx response (with `status`), on timeout (`code: 'TIMEOUT'`), or when the
 * API is not configured (`code: 'NO_API'`). Returns `undefined` for 204.
 */
export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (!isApiConfigured()) {
    throw apiError('API base URL is not configured (VITE_API_BASE_URL unset)', { code: 'NO_API' });
  }

  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener('abort', onExternalAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15000);

  const token = tokenProvider();
  const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = 'Bearer ' + token;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method: opts.method || 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: 'omit',
      signal: controller.signal,
    });
  } catch (e: any) {
    if (controller.signal.aborted && !(opts.signal && opts.signal.aborted)) {
      throw apiError('Request timed out', { code: 'TIMEOUT' });
    }
    throw apiError(e?.message || 'Network error', { code: 'NETWORK' });
  } finally {
    clearTimeout(timer);
    if (opts.signal) opts.signal.removeEventListener('abort', onExternalAbort);
  }

  if (!res.ok) {
    let details: unknown;
    try { details = await res.json(); } catch { /* non-JSON error body */ }
    throw apiError('HTTP ' + res.status, { status: res.status, code: 'HTTP_' + res.status, details });
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
