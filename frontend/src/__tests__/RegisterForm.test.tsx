import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterForm } from '../components/auth/RegisterForm';
import type { AuthContextValue } from '../context/authContextValue';
import { makeAxiosError, makeUser } from './utils/fixtures';
import { renderWithProviders } from './utils/render';

const setup = (register: AuthContextValue['register'] = vi.fn<AuthContextValue['register']>()) => {
  const onSuccess = vi.fn<() => void>();
  renderWithProviders(<RegisterForm onSuccess={onSuccess} />, { auth: { register } });
  return { onSuccess, register, user: userEvent.setup() };
};

const fill = async (
  user: ReturnType<typeof userEvent.setup>,
  values: { name?: string; email?: string; password?: string; confirm?: string },
): Promise<void> => {
  if (values.name) await user.type(screen.getByLabelText(/^full name/i), values.name);
  if (values.email) await user.type(screen.getByLabelText(/^email/i), values.email);
  if (values.password) await user.type(screen.getByLabelText(/^password/i), values.password);
  if (values.confirm) await user.type(screen.getByLabelText(/^confirm password/i), values.confirm);
};

const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Create account' }));

describe('RegisterForm', () => {
  it('rejects mismatched passwords', async () => {
    const { user, register } = setup();
    await fill(user, { email: 'a@b.co', password: 'password123', confirm: 'password124' });
    await submit(user);
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('requires confirmation and minimum password length', async () => {
    const { user, register } = setup();
    await fill(user, { email: 'a@b.co', password: 'short' });
    await submit(user);
    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(screen.getByText('Please confirm your password')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('submits without full_name when the name is blank', async () => {
    const register = vi.fn<AuthContextValue['register']>().mockResolvedValue(makeUser());
    const { user, onSuccess } = setup(register);
    await fill(user, { email: ' a@b.co ', password: 'password123', confirm: 'password123' });
    await submit(user);
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(register).toHaveBeenCalledWith({ email: 'a@b.co', password: 'password123' });
  });

  it('submits a trimmed full_name when provided', async () => {
    const register = vi.fn<AuthContextValue['register']>().mockResolvedValue(makeUser());
    const { user } = setup(register);
    await fill(user, { name: '  Ada  ', email: 'a@b.co', password: 'password123', confirm: 'password123' });
    await submit(user);
    await waitFor(() =>
      expect(register).toHaveBeenCalledWith({ email: 'a@b.co', password: 'password123', full_name: 'Ada' }),
    );
  });

  it('shows a conflict error from the API', async () => {
    const register = vi
      .fn<AuthContextValue['register']>()
      .mockRejectedValue(makeAxiosError(409, { detail: 'An account with this email already exists' }));
    const { user, onSuccess } = setup(register);
    await fill(user, { email: 'a@b.co', password: 'password123', confirm: 'password123' });
    await submit(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('An account with this email already exists');
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
