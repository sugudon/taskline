import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import api, { API_BASE_URL, getErrorMessage, tokenStorage } from '../services/api';
import { makeAxiosError } from './utils/fixtures';

type Handler = (config: InternalAxiosRequestConfig) => { status: number; data: unknown };

const respond = (config: InternalAxiosRequestConfig, status: number, data: unknown): AxiosResponse => ({
  data,
  status,
  statusText: String(status),
  headers: {},
  config,
});

/** Install a fake adapter on the shared axios instance. */
const installAdapter = (handler: Handler) => {
  const adapter = vi.fn<AxiosAdapter>(async (config) => {
    const { status, data } = handler(config);
    const response = respond(config, status, data);
    if (status >= 400) {
      throw new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST', config, null, response);
    }
    return response;
  });
  api.defaults.adapter = adapter;
  return adapter;
};

const authHeader = (config: InternalAxiosRequestConfig): string | undefined => {
  const value = AxiosHeaders.from(config.headers).get('Authorization');
  return typeof value === 'string' ? value : undefined;
};

const originalLocation = window.location;
const assign = vi.fn<(url: string) => void>();

beforeAll(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, pathname: '/dashboard', assign },
  });
});

afterAll(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
});

afterEach(() => {
  vi.restoreAllMocks();
  assign.mockReset();
  tokenStorage.clear();
});

describe('tokenStorage', () => {
  it('stores, reads and clears both tokens', () => {
    tokenStorage.set('a', 'r');
    expect(tokenStorage.getAccess()).toBe('a');
    expect(tokenStorage.getRefresh()).toBe('r');
    tokenStorage.clear();
    expect(tokenStorage.getAccess()).toBeNull();
    expect(tokenStorage.getRefresh()).toBeNull();
  });
});

describe('getErrorMessage', () => {
  it('reads a string detail', () => {
    expect(getErrorMessage(makeAxiosError(404, { detail: 'Project not found', code: 'NOT_FOUND' }))).toBe(
      'Project not found',
    );
  });

  it('joins validation error messages', () => {
    const err = makeAxiosError(422, {
      detail: [
        { msg: 'field required', loc: ['body', 'email'], type: 'missing' },
        { msg: 'too short', loc: ['body', 'password'], type: 'string_too_short' },
      ],
    });
    expect(getErrorMessage(err)).toBe('field required, too short');
  });

  it('falls back to the axios message for empty details', () => {
    expect(getErrorMessage(makeAxiosError(500, { detail: '' }))).toBe('Request failed with status code 500');
    expect(getErrorMessage(makeAxiosError(500, { detail: [] }))).toBe('Request failed with status code 500');
    const noMessage = makeAxiosError(500, {});
    noMessage.message = '';
    expect(getErrorMessage(noMessage)).toBe('Request failed');
  });

  it('reports network errors when there is no response', () => {
    expect(getErrorMessage(new AxiosError('Network Error', 'ERR_NETWORK'))).toBe(
      'Network error — is the server running?',
    );
  });

  it('handles plain errors and unknown values', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage('nope')).toBe('Something went wrong');
    expect(getErrorMessage(undefined)).toBe('Something went wrong');
  });
});

describe('api client', () => {
  it('uses the /api/v1 base URL', () => {
    expect(API_BASE_URL.endsWith('/api/v1')).toBe(true);
    expect(api.defaults.baseURL).toBe(API_BASE_URL);
  });

  it('attaches the bearer token when present', async () => {
    const adapter = installAdapter(() => ({ status: 200, data: { ok: true } }));
    await api.get('/anon');
    expect(authHeader(adapter.mock.calls[0][0])).toBeUndefined();

    tokenStorage.set('access-1', 'refresh-1');
    await api.get('/me');
    expect(authHeader(adapter.mock.calls[1][0])).toBe('Bearer access-1');
  });

  it('refreshes once for concurrent 401s and retries every request (single-flight)', async () => {
    tokenStorage.set('stale', 'refresh-1');
    let releaseRefresh: () => void = () => undefined;
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    const post = vi.spyOn(axios, 'post').mockImplementation(async () => {
      await refreshGate;
      return { data: { access_token: 'fresh', refresh_token: 'refresh-2', token_type: 'bearer' } };
    });
    const adapter = installAdapter((config) =>
      authHeader(config) === 'Bearer fresh'
        ? { status: 200, data: { url: config.url } }
        : { status: 401, data: { detail: 'Invalid or expired token' } },
    );

    const pending = Promise.all([api.get('/a'), api.get('/b'), api.get('/c')]);
    // Let all three 401s arrive before the refresh resolves.
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(3));
    releaseRefresh();
    const results = await pending;

    expect(results.map((r) => r.data)).toEqual([{ url: '/a' }, { url: '/b' }, { url: '/c' }]);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(`${API_BASE_URL}/auth/refresh`, { refresh_token: 'refresh-1' });
    expect(tokenStorage.getAccess()).toBe('fresh');
    expect(tokenStorage.getRefresh()).toBe('refresh-2');
    expect(adapter).toHaveBeenCalledTimes(6);

    // A later 401 triggers a new refresh (the in-flight promise was reset).
    tokenStorage.set('stale-again', 'refresh-2');
    post.mockResolvedValueOnce({ data: { access_token: 'fresh', refresh_token: 'refresh-3', token_type: 'bearer' } });
    await api.get('/d');
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('clears tokens and redirects to /login when refresh fails', async () => {
    tokenStorage.set('stale', 'bad-refresh');
    const refreshError = makeAxiosError(401, { detail: 'Invalid or expired refresh token' });
    vi.spyOn(axios, 'post').mockRejectedValue(refreshError);
    installAdapter(() => ({ status: 401, data: { detail: 'expired' } }));

    await expect(api.get('/me')).rejects.toBe(refreshError);
    expect(tokenStorage.getAccess()).toBeNull();
    expect(tokenStorage.getRefresh()).toBeNull();
    expect(assign).toHaveBeenCalledWith('/login');
  });

  it('redirects without calling refresh when no refresh token is stored', async () => {
    const post = vi.spyOn(axios, 'post');
    installAdapter(() => ({ status: 401, data: { detail: 'Not authenticated' } }));
    await expect(api.get('/me')).rejects.toThrow('No refresh token');
    expect(post).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith('/login');
  });

  it.each(['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'])(
    'does not try to refresh for %s',
    async (url) => {
      tokenStorage.set('a', 'r');
      const post = vi.spyOn(axios, 'post');
      installAdapter(() => ({ status: 401, data: { detail: 'Incorrect email or password' } }));
      const error: unknown = await api.post(url, {}).catch((e: unknown) => e);
      expect(getErrorMessage(error)).toBe('Incorrect email or password');
      expect(post).not.toHaveBeenCalled();
      expect(tokenStorage.getAccess()).toBe('a');
    },
  );

  it('does not loop when the retried request is still unauthorized', async () => {
    tokenStorage.set('stale', 'refresh-1');
    const post = vi
      .spyOn(axios, 'post')
      .mockResolvedValue({ data: { access_token: 'fresh', refresh_token: 'r2', token_type: 'bearer' } });
    const adapter = installAdapter(() => ({ status: 401, data: { detail: 'still no' } }));
    const error: unknown = await api.get('/me').catch((e: unknown) => e);
    expect(getErrorMessage(error)).toBe('still no');
    expect(post).toHaveBeenCalledTimes(1);
    expect(adapter).toHaveBeenCalledTimes(2);
  });

  it('does not refresh on 429 rate limiting and surfaces the detail', async () => {
    tokenStorage.set('a', 'r');
    const post = vi.spyOn(axios, 'post');
    installAdapter(() => ({
      status: 429,
      data: { detail: 'Too many requests, slow down.', code: 'RATE_LIMITED' },
    }));
    const error: unknown = await api.post('/auth/login', {}).catch((e: unknown) => e);
    expect(getErrorMessage(error)).toBe('Too many requests, slow down.');
    const error2: unknown = await api.get('/projects').catch((e: unknown) => e);
    expect(getErrorMessage(error2)).toBe('Too many requests, slow down.');
    expect(post).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    expect(tokenStorage.getAccess()).toBe('a');
  });

  it('reuses tokens rotated by another tab instead of refreshing again', async () => {
    tokenStorage.set('stale', 'refresh-1');
    const post = vi.spyOn(axios, 'post');
    const adapter = installAdapter((config) => {
      if (authHeader(config) === 'Bearer stale') {
        // Another tab refreshes while this request is in flight.
        tokenStorage.set('other-tab-access', 'refresh-2');
        return { status: 401, data: { detail: 'expired' } };
      }
      return { status: 200, data: { auth: authHeader(config) } };
    });
    const res = await api.get('/me');
    expect(res.data).toEqual({ auth: 'Bearer other-tab-access' });
    expect(post).not.toHaveBeenCalled();
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(tokenStorage.getRefresh()).toBe('refresh-2');
  });

  describe('with the Web Locks API', () => {
    const request = vi.fn(<T,>(_name: string, cb: () => Promise<T>): Promise<T> => cb());

    beforeEach(() => {
      Object.defineProperty(navigator, 'locks', { configurable: true, value: { request } });
    });

    afterEach(() => {
      Reflect.deleteProperty(navigator, 'locks');
      request.mockClear();
    });

    it('serializes the refresh under the auth-refresh lock', async () => {
      tokenStorage.set('stale', 'refresh-1');
      const post = vi
        .spyOn(axios, 'post')
        .mockResolvedValue({ data: { access_token: 'fresh', refresh_token: 'refresh-2', token_type: 'bearer' } });
      installAdapter((config) =>
        authHeader(config) === 'Bearer fresh'
          ? { status: 200, data: { ok: true } }
          : { status: 401, data: { detail: 'expired' } },
      );
      const res = await api.get('/me');
      expect(res.data).toEqual({ ok: true });
      expect(request).toHaveBeenCalledTimes(1);
      expect(request.mock.calls[0][0]).toBe('auth-refresh');
      expect(post).toHaveBeenCalledWith(`${API_BASE_URL}/auth/refresh`, { refresh_token: 'refresh-1' });
      expect(tokenStorage.getRefresh()).toBe('refresh-2');
    });

    it('skips the network refresh if the token changed while waiting for the lock', async () => {
      tokenStorage.set('stale', 'refresh-1');
      request.mockImplementationOnce(async <T,>(_name: string, cb: () => Promise<T>): Promise<T> => {
        // The other tab held the lock and rotated the tokens before we got it.
        tokenStorage.set('from-other-tab', 'refresh-9');
        return cb();
      });
      const post = vi.spyOn(axios, 'post');
      installAdapter((config) =>
        authHeader(config) === 'Bearer from-other-tab'
          ? { status: 200, data: { ok: true } }
          : { status: 401, data: { detail: 'expired' } },
      );
      const res = await api.get('/me');
      expect(res.data).toEqual({ ok: true });
      expect(post).not.toHaveBeenCalled();
    });
  });

  it('passes through non-401 errors untouched', async () => {
    const post = vi.spyOn(axios, 'post');
    installAdapter(() => ({ status: 403, data: { detail: 'Forbidden', code: 'FORBIDDEN' } }));
    const error: unknown = await api.get('/projects/1').catch((e: unknown) => e);
    expect(getErrorMessage(error)).toBe('Forbidden');
    expect(post).not.toHaveBeenCalled();
  });
});
