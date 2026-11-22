import { ApiError } from './apiError';

export { ApiError } from './apiError';

const BASE: string = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');
const TOKEN_KEY = 'nutrition.token';
const NOTICE_KEY = 'nutrition.notice';
const TIMEOUT_MS = 90_000; // free hosting can take a minute to wake up

// NOTE: a JWT in localStorage is readable by any script on the page. Acceptable for an internal tool
// behind HTTPS; move to an httpOnly cookie if the dashboard is ever exposed more widely.
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

/** A one-time message for the login page (e.g. "your session expired"). */
export const takeNotice = () => {
  const n = sessionStorage.getItem(NOTICE_KEY);
  sessionStorage.removeItem(NOTICE_KEY);
  return n;
};

/** fetch with a timeout, turning "no response" failures into a readable ApiError. */
async function send(path: string, init: RequestInit): Promise<Response> {
  const url = BASE + path;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    const timedOut = e instanceof DOMException && e.name === 'AbortError';
    throw new ApiError(0, timedOut ? 'The request timed out' : 'Network request failed', undefined, timedOut ? 'TIMEOUT' : 'NETWORK', undefined, url);
  } finally {
    clearTimeout(timer);
  }
}

async function toApiError(res: Response, path: string): Promise<ApiError> {
  const data = await res.json().catch(() => null);
  return new ApiError(
    res.status,
    data?.error ?? (res.statusText || `Request failed (${res.status})`),
    data?.details,
    data?.code,
    data?.requestId ?? res.headers.get('X-Request-Id') ?? undefined,
    BASE + path,
  );
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  const res = await send(path, {
    method: opts.method ?? 'GET',
    headers: { ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const err = await toApiError(res, path);
    if (res.status === 401 && token && err.code !== 'INVALID_CREDENTIALS') {
      setToken(null);
      sessionStorage.setItem(NOTICE_KEY, 'Your session has expired. Please sign in again.');
      window.dispatchEvent(new Event('auth:expired'));
    }
    throw err;
  }
  return (await res.json().catch(() => null)) as T;
}

export const qs = (params: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== null && v !== '' && p.set(k, String(v)));
  const s = p.toString();
  return s ? `?${s}` : '';
};

/** Downloads a file from an authenticated endpoint (a plain link cannot send the bearer token). */
export async function download(path: string, fallbackName: string) {
  const token = getToken();
  const res = await send(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw await toApiError(res, path);
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
