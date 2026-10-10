import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiErrorBody, Token } from '../types';

export const API_BASE_URL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/v1`;

const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';

export const tokenStorage = {
  getAccess(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  getRefresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string): void {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

const api = axios.create({ baseURL: API_BASE_URL });

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  /** Refresh token that was stored when this request was sent (detects rotation by another tab). */
  _refreshAtSend?: string | null;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccess();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  (config as RetriableConfig)._refreshAtSend = tokenStorage.getRefresh();
  return config;
});

const AUTH_PATHS_WITHOUT_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];
const REFRESH_LOCK_NAME = 'auth-refresh';

/**
 * Perform the refresh. Runs while holding the cross-tab lock (when available), so by the time we get
 * here another tab may already have rotated the tokens: if the stored refresh token differs from the
 * one the failing request was sent with, reuse the stored tokens instead of spending the (now revoked)
 * old refresh token.
 */
const performRefresh = async (refreshAtSend: string | null | undefined): Promise<string> => {
  const currentRefresh = tokenStorage.getRefresh();
  if (!currentRefresh) throw new Error('No refresh token');
  const currentAccess = tokenStorage.getAccess();
  if (refreshAtSend && currentRefresh !== refreshAtSend && currentAccess) {
    return currentAccess;
  }
  const { data } = await axios.post<Token>(`${API_BASE_URL}/auth/refresh`, { refresh_token: currentRefresh });
  tokenStorage.set(data.access_token, data.refresh_token);
  return data.access_token;
};

/** Serialize refreshes across tabs with the Web Locks API; fall back to in-tab only. */
const withRefreshLock = <T>(fn: () => Promise<T>): Promise<T> => {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (locks && typeof locks.request === 'function') {
    return locks.request(REFRESH_LOCK_NAME, fn);
  }
  return fn();
};

let refreshPromise: Promise<string> | null = null;

/** Single-flight refresh: concurrent 401s in this tab share one refresh; tabs coordinate via a lock. */
const refreshAccessToken = (refreshAtSend: string | null | undefined): Promise<string> => {
  if (!refreshPromise) {
    refreshPromise = withRefreshLock(() => performRefresh(refreshAtSend)).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

const redirectToLogin = (): void => {
  tokenStorage.clear();
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.assign('/login');
  }
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const url = original?.url ?? '';
    const isAuthPath = AUTH_PATHS_WITHOUT_REFRESH.some((p) => url.includes(p));

    // Only 401 triggers a refresh — e.g. 429 RATE_LIMITED or 403 pass straight through.
    if (error.response?.status === 401 && original && !original._retry && !isAuthPath) {
      original._retry = true;
      try {
        const newAccess = await refreshAccessToken(original._refreshAtSend);
        original.headers.set('Authorization', `Bearer ${newAccess}`);
        return api(original);
      } catch (refreshError) {
        redirectToLogin();
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  },
);

/** Extract a human-readable message from any thrown error (reads FastAPI `detail`). */
export const getErrorMessage = (err: unknown): string => {
  if (axios.isAxiosError<ApiErrorBody>(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string' && detail.length > 0) return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      return detail.map((d) => d.msg).join(', ');
    }
    if (!err.response) return 'Network error — is the server running?';
    return err.message || 'Request failed';
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
};

export default api;
