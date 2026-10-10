import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { makeUser } from './utils/fixtures';
import { renderWithProviders } from './utils/render';

describe('ProtectedRoute', () => {
  it('shows a loading state while the session is being checked', () => {
    renderWithProviders(
      <ProtectedRoute>
        <div>secret</div>
      </ProtectedRoute>,
      { route: '/dashboard', auth: { isLoading: true } },
    );
    expect(screen.getByText('Checking your session...')).toBeInTheDocument();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('redirects anonymous users to /login', () => {
    renderWithProviders(
      <ProtectedRoute>
        <div>secret</div>
      </ProtectedRoute>,
      { route: '/dashboard?tab=1', path: '/dashboard', routes: { '/login': <div>login page</div> } },
    );
    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('renders children for an authenticated user', () => {
    renderWithProviders(
      <ProtectedRoute>
        <div>secret</div>
      </ProtectedRoute>,
      { route: '/dashboard', auth: { user: makeUser() } },
    );
    expect(screen.getByText('secret')).toBeInTheDocument();
  });

  it('renders the nested route via Outlet when used as a layout route', () => {
    renderWithProviders(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="inner" element={<div>inner page</div>} />
        </Route>
      </Routes>,
      { route: '/app/inner', path: '/app/*', auth: { user: makeUser() } },
    );
    expect(screen.getByText('inner page')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/app/inner');
  });
});
