/**
 * Tiny fetch wrapper for the Q-Tools backend API.
 *
 * - Injects `Authorization: Bearer <accessToken>` when available.
 * - Parses JSON responses.
 * - Throws a typed `ApiError` on non-2xx responses.
 * - Retries once with a refreshed access token on 401.
 *
 * Kept dependency-free (native `fetch`) so it works in embed mode and
 * adds nothing to the bundle. The auth store is imported lazily inside
 * the retry path to avoid a circular import at module load.
 */
import type { UserProfile } from '@q-tools/shared';

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Skip auth header injection (e.g. for /api/auth/login). */
  skipAuth?: boolean;
  /** Override the access token used for this request. */
  accessToken?: string;
  signal?: AbortSignal;
}

export interface ApiResponse<T> {
  status: number;
  data: T;
}

const JSON_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

function isJsonResponse(res: Response): boolean {
  const ct = res.headers.get('content-type') ?? '';
  return ct.includes('application/json');
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  if (isJsonResponse(res)) {
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return res.text();
}

/**
 * Lazily resolve the current access token. Imported dynamically to
 * avoid a circular dependency between `api.ts` and `authStore.ts`.
 */
async function resolveAccessToken(): Promise<string | null> {
  const mod = await import('@/stores/authStore');
  const store = mod.useAuthStore();
  return store.accessToken ?? null;
}

async function refreshAccessToken(): Promise<string | null> {
  const mod = await import('@/stores/authStore');
  const store = mod.useAuthStore();
  if (!store.refreshToken) return null;
  try {
    await store.refresh();
    return store.accessToken ?? null;
  } catch {
    return null;
  }
}

/**
 * Perform an authenticated API request. Retries once on 401 by
 * refreshing the access token.
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: ApiOptions = {},
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, skipAuth = false, signal } = options;

  async function attempt(token: string | null): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = { ...JSON_HEADERS };
    if (!skipAuth && token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const init: RequestInit = { method, headers, signal };
    if (body !== undefined && method !== 'GET' && method !== 'DELETE') {
      init.body = JSON.stringify(body);
    }

    const res = await fetch(path, init);
    const data = (await parseBody(res)) as T;

    if (!res.ok) {
      const message =
        (data && typeof data === 'object' && 'message' in data && typeof (data as { message: unknown }).message === 'string'
          ? (data as { message: string }).message
          : `Request failed (${res.status})`);
      throw new ApiError(res.status, message, data);
    }
    return { status: res.status, data };
  }

  const token = options.accessToken ?? (skipAuth ? null : await resolveAccessToken());
  try {
    return await attempt(token);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && !skipAuth) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return await attempt(refreshed);
      }
    }
    throw err;
  }
}

/** Convenience typed helpers. */
export const api = {
  get: <T = unknown>(path: string, opts?: Omit<ApiOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...opts, method: 'GET' }),
  post: <T = unknown>(path: string, body?: unknown, opts?: Omit<ApiOptions, 'method'>) =>
    apiRequest<T>(path, { ...opts, method: 'POST', body }),
  patch: <T = unknown>(path: string, body?: unknown, opts?: Omit<ApiOptions, 'method'>) =>
    apiRequest<T>(path, { ...opts, method: 'PATCH', body }),
  put: <T = unknown>(path: string, body?: unknown, opts?: Omit<ApiOptions, 'method'>) =>
    apiRequest<T>(path, { ...opts, method: 'PUT', body }),
  delete: <T = unknown>(path: string, opts?: Omit<ApiOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...opts, method: 'DELETE' }),
};

export type { UserProfile };
