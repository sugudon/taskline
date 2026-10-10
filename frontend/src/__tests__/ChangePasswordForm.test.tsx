import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChangePasswordForm } from '../components/settings/ChangePasswordForm';
import { SettingsPage } from '../pages/SettingsPage';
import { makeAxiosError, makeUser } from './utils/fixtures';
import { mockApi, resetMockApi } from './utils/apiMock';
import { renderWithProviders } from './utils/render';

vi.mock('../services/api', () => import('./utils/apiMock'));

beforeEach(() => resetMockApi());

const NOTE = /there's no\s+password to change/i;

describe('SettingsPage password section (has_password)', () => {
  it('shows the OAuth note for a Google user without a password', () => {
    renderWithProviders(<SettingsPage />, {
      auth: { user: makeUser({ oauth_provider: 'google', has_password: false }) },
    });
    expect(screen.getByText(NOTE)).toBeInTheDocument();
    expect(screen.getByText(/You sign in with Google/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^current password/i)).not.toBeInTheDocument();
  });

  it('shows the form for a Google-linked user who also has a password', () => {
    renderWithProviders(<SettingsPage />, {
      auth: { user: makeUser({ oauth_provider: 'google', has_password: true }) },
    });
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^current password/i)).toBeInTheDocument();
  });

  it('shows the form for an email/password user', () => {
    renderWithProviders(<SettingsPage />, { auth: { user: makeUser() } });
    expect(screen.getByLabelText(/^new password/i)).toBeInTheDocument();
    expect(screen.getByText('Email & password')).toBeInTheDocument();
  });

  it('shows a loading state without a user', () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

describe('ChangePasswordForm', () => {
  const fill = async (user: ReturnType<typeof userEvent.setup>, current: string, next: string, confirm: string) => {
    if (current) await user.type(screen.getByLabelText(/^current password/i), current);
    if (next) await user.type(screen.getByLabelText(/^new password/i), next);
    if (confirm) await user.type(screen.getByLabelText(/^confirm new password/i), confirm);
    await user.click(screen.getByRole('button', { name: 'Update password' }));
  };

  it('validates the fields', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChangePasswordForm oauthProvider={null} />);
    await fill(user, '', 'short', 'other');
    expect(await screen.findByText('Current password is required')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(mockApi.put).not.toHaveBeenCalled();
  });

  it('requires the new password to differ', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChangePasswordForm oauthProvider={null} />);
    await fill(user, 'password123', 'password123', 'password123');
    expect(await screen.findByText('New password must differ from the current one')).toBeInTheDocument();
  });

  it('submits and clears the form on success', async () => {
    mockApi.put.mockResolvedValue({ data: undefined });
    const user = userEvent.setup();
    renderWithProviders(<ChangePasswordForm oauthProvider={null} />);
    await fill(user, 'password123', 'brand-new-pass', 'brand-new-pass');
    await waitFor(() =>
      expect(mockApi.put).toHaveBeenCalledWith('/auth/password', {
        current_password: 'password123',
        new_password: 'brand-new-pass',
      }),
    );
    expect(await screen.findByText('Password updated')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/^current password/i)).toHaveValue(''));
  });

  it('shows the API error in a toast', async () => {
    mockApi.put.mockRejectedValue(makeAxiosError(400, { detail: 'Current password is incorrect' }));
    const user = userEvent.setup();
    renderWithProviders(<ChangePasswordForm oauthProvider={null} />);
    await fill(user, 'wrong-pass', 'brand-new-pass', 'brand-new-pass');
    expect(await screen.findByText('Could not change password')).toBeInTheDocument();
    expect(screen.getByText('Current password is incorrect')).toBeInTheDocument();
  });
});
