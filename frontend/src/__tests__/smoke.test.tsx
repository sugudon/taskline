import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { App } from '../App';
import { theme } from '../theme';
import { AuthProvider } from '../context/AuthContext';
import { createQueryClient } from '../lib/queryClient';
import { getErrorMessage, tokenStorage } from '../services/api';

const renderAt = (path: string) =>
  render(
    <ChakraProvider theme={theme}>
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter initialEntries={[path]}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </ChakraProvider>,
  );

describe('foundation smoke', () => {
  beforeEach(() => tokenStorage.clear());

  it('redirects unauthenticated users from a protected route to /login', async () => {
    renderAt('/dashboard');
    expect(await screen.findByRole('heading', { name: 'Sign in' }, { timeout: 3000 })).toBeInTheDocument();
  });

  it('renders the 404 page for unknown routes', async () => {
    renderAt('/nope');
    expect(await screen.findByText('404')).toBeInTheDocument();
  });

  it('getErrorMessage handles plain errors and unknowns', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage(42)).toBe('Something went wrong');
  });
});
