/**
 * Drop-in replacement for `src/services/api` used with:
 *   vi.mock('../services/api', () => import('./utils/apiMock'));
 * The default export (the axios instance) is replaced by vi.fn() methods; helpers stay real.
 */
import { vi } from 'vitest';
import type * as ApiModule from '../../services/api';

const actual = await vi.importActual<typeof ApiModule>('../../services/api');

export interface MockResponse<T = unknown> {
  data: T;
}

type RequestFn = (url: string, ...args: unknown[]) => Promise<MockResponse>;

export const mockApi = {
  get: vi.fn<RequestFn>(),
  post: vi.fn<RequestFn>(),
  put: vi.fn<RequestFn>(),
  patch: vi.fn<RequestFn>(),
  delete: vi.fn<RequestFn>(),
};

export const resetMockApi = (): void => {
  Object.values(mockApi).forEach((fn) => fn.mockReset());
};

/** Route GET requests by exact URL; unknown URLs reject. */
export const routeGet = (routes: Record<string, unknown>): void => {
  mockApi.get.mockImplementation(async (url: string) => {
    if (url in routes) return { data: routes[url] };
    throw new Error(`Unexpected GET ${url}`);
  });
};

export const API_BASE_URL = actual.API_BASE_URL;
export const tokenStorage = actual.tokenStorage;
export const getErrorMessage = actual.getErrorMessage;
export default mockApi;
