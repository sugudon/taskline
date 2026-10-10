import { act, render, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AuthProvider } from '../context/AuthContext';
import { useAuth } from '../hooks/useAuth';
import { tokenStorage } from '../services/api';
import { makeUser } from './utils/fixtures';
import { mockApi, resetMockApi } from './utils/apiMock';
import { createTestQueryClient } from './utils/render';

vi.mock('../services/api', () => import('./utils/apiMock'));

const queryClient = createTestQueryClient();
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>{children}</AuthProvider>
  </QueryClientProvider>
);

const TOKEN = { access_token: 'acc', refresh_token: 'ref', token_type: 'bearer' as const };

beforeEach(() => resetMockApi());

describe('AuthProvider', () => {
  it('starts anonymous without a stored token', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it('loads the current user when a token is stored', async () => {
    tokenStorage.set('acc', 'ref');
    mockApi.get.mockResolvedValue({ data: makeUser({ id: 5 }) });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.user?.id).toBe(5);
    expect(mockApi.get).toHaveBeenCalledWith('/auth/me');
  });

  it('clears tokens when the stored session is invalid', async () => {
    tokenStorage.set('acc', 'ref');
    mockApi.get.mockRejectedValue(new Error('401'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(tokenStorage.getAccess()).toBeNull();
  });

  it('logs in with a form-encoded body and stores tokens', async () => {
    mockApi.post.mockResolvedValue({ data: TOKEN });
    mockApi.get.mockResolvedValue({ data: makeUser() });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(() => result.current.login('ada@example.com', 'pw'));
    const [url, body, config] = mockApi.post.mock.calls[0];
    expect(url).toBe('/auth/login');
    expect(String(body)).toBe('username=ada%40example.com&password=pw');
    expect(config).toEqual({ headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    expect(tokenStorage.getAccess()).toBe('acc');
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('registers and stores tokens', async () => {
    mockApi.post.mockResolvedValue({ data: TOKEN });
    mockApi.get.mockResolvedValue({ data: makeUser() });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(() => result.current.register({ email: 'a@b.co', password: 'password123' }));
    expect(mockApi.post).toHaveBeenCalledWith('/auth/register', { email: 'a@b.co', password: 'password123' });
    expect(tokenStorage.getRefresh()).toBe('ref');
  });

  it('logs out even if the API call fails', async () => {
    tokenStorage.set('acc', 'ref');
    mockApi.get.mockResolvedValue({ data: makeUser() });
    mockApi.post.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    await act(() => result.current.logout());
    expect(mockApi.post).toHaveBeenCalledWith('/auth/logout', { refresh_token: 'ref' });
    expect(result.current.user).toBeNull();
    expect(tokenStorage.getAccess()).toBeNull();
  });

  it('setTokens stores tokens and loads the user', async () => {
    mockApi.get.mockResolvedValue({ data: makeUser({ id: 9 }) });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let loaded: Awaited<ReturnType<typeof result.current.setTokens>> = null;
    await act(async () => {
      loaded = await result.current.setTokens('a2', 'r2');
    });
    expect(loaded).toMatchObject({ id: 9 });
    expect(tokenStorage.getAccess()).toBe('a2');
  });
});

describe('useAuth', () => {
  it('throws outside an AuthProvider', () => {
    const Broken = () => {
      useAuth();
      return null;
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Broken />)).toThrow('useAuth must be used within an AuthProvider');
    spy.mockRestore();
  });
});
