import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '../components/auth/LoginForm';
import type { AuthContextValue } from '../context/authContextValue';
import { makeAxiosError, makeUser } from './utils/fixtures';
import { renderWithProviders } from './utils/render';

const setup = (login: AuthContextValue['login'] = vi.fn<AuthContextValue['login']>()) => {
  const onSuccess = vi.fn<() => void>();
  const utils = renderWithProviders(<LoginForm onSuccess={onSuccess} />, { auth: { login } });
  return { ...utils, onSuccess, login, user: userEvent.setup() };
};

const emailInput = (): HTMLElement => screen.getByLabelText(/^email/i);
const passwordInput = (): HTMLElement => screen.getByLabelText(/^password/i);

describe('LoginForm', () => {
  it('shows required-field errors and does not call login', async () => {
    const { user, login } = setup();
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('validates email format and clears the error on edit', async () => {
    const { user, login } = setup();
    await user.type(emailInput(), 'not-an-email');
    await user.type(passwordInput(), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();

    await user.type(emailInput(), 'x');
    expect(screen.queryByText('Enter a valid email address')).not.toBeInTheDocument();
  });

  it('submits trimmed email and calls onSuccess', async () => {
    const login = vi.fn<AuthContextValue['login']>().mockResolvedValue(makeUser());
    const { user, onSuccess } = setup(login);
    await user.type(emailInput(), '  ada@example.com ');
    await user.type(passwordInput(), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(login).toHaveBeenCalledWith('ada@example.com', 'password123');
  });

  it('shows the API error message when login fails', async () => {
    const login = vi
      .fn<AuthContextValue['login']>()
      .mockRejectedValue(makeAxiosError(401, { detail: 'Incorrect email or password', code: 'UNAUTHORIZED' }));
    const { user, onSuccess } = setup(login);
    await user.type(emailInput(), 'ada@example.com');
    await user.type(passwordInput(), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password');
    expect(onSuccess).not.toHaveBeenCalled();
    // The button is usable again after a failure.
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('toggles password visibility', async () => {
    const { user } = setup();
    expect(passwordInput()).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(passwordInput()).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(passwordInput()).toHaveAttribute('type', 'password');
  });
});
