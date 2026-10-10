import type { ReactElement, ReactNode } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { LocationDisplay } from './LocationDisplay';
import { vi } from 'vitest';
import { theme } from '../../theme';
import { AuthContext, type AuthContextValue } from '../../context/authContextValue';


export const createTestQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: 0 },
      mutations: { retry: false },
    },
  });

export const createAuthValue = (overrides: Partial<AuthContextValue> = {}): AuthContextValue => {
  const user = overrides.user ?? null;
  return {
    user,
    isLoading: false,
    isAuthenticated: user !== null,
    login: vi.fn<AuthContextValue['login']>(),
    register: vi.fn<AuthContextValue['register']>(),
    logout: vi.fn<AuthContextValue['logout']>(),
    refreshUser: vi.fn<AuthContextValue['refreshUser']>(),
    setTokens: vi.fn<AuthContextValue['setTokens']>(),
    setUser: vi.fn<AuthContextValue['setUser']>(),
    ...overrides,
  };
};

export interface RenderOptions {
  route?: string;
  /** Route pattern for `ui`, e.g. "/projects/:id". Defaults to "*". */
  path?: string;
  /** Extra routes rendered alongside, e.g. { '/login': <div>login</div> }. */
  routes?: Record<string, ReactNode>;
  auth?: Partial<AuthContextValue>;
  queryClient?: QueryClient;
}

export interface RenderWithProvidersResult extends RenderResult {
  auth: AuthContextValue;
  queryClient: QueryClient;
}

export const renderWithProviders = (ui: ReactElement, options: RenderOptions = {}): RenderWithProvidersResult => {
  const { route = '/', path = '*', routes = {}, queryClient = createTestQueryClient() } = options;
  const auth = createAuthValue(options.auth);
  const result = render(
    <ChakraProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={auth}>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path={path} element={ui} />
              {Object.entries(routes).map(([routePath, element]) => (
                <Route key={routePath} path={routePath} element={element} />
              ))}
            </Routes>
            <LocationDisplay />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    </ChakraProvider>,
  );
  return { ...result, auth, queryClient };
};
