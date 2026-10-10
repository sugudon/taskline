import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileForm } from '../components/auth/ProfileForm';
import { makeAxiosError, makeUser } from './utils/fixtures';
import { mockApi, resetMockApi } from './utils/apiMock';
import { renderWithProviders } from './utils/render';

vi.mock('../services/api', () => import('./utils/apiMock'));

beforeEach(() => resetMockApi());

const setup = () => {
  const current = makeUser({ full_name: 'Ada', avatar_url: null });
  const result = renderWithProviders(<ProfileForm user={current} />, { auth: { user: current } });
  return { ...result, user: userEvent.setup() };
};

describe('ProfileForm', () => {
  it('disables save until something changes', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
  });

  it.each([
    ['not a url', 'Enter a valid URL'],
    ['javascript:alert(1)', 'URL must start with http:// or https://'],
    ['ftp://example.com/a.png', 'URL must start with http:// or https://'],
  ])('rejects avatar URL %s', async (value, message) => {
    const { user } = setup();
    await user.type(screen.getByLabelText('Avatar URL'), value);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(mockApi.put).not.toHaveBeenCalled();
  });

  it('saves a valid avatar URL and pushes the user into auth context', async () => {
    const updated = makeUser({ full_name: 'Ada L', avatar_url: 'https://example.com/me.png' });
    mockApi.put.mockResolvedValue({ data: updated });
    const { user, auth } = setup();
    await user.clear(screen.getByLabelText('Full name'));
    await user.type(screen.getByLabelText('Full name'), 'Ada L');
    await user.type(screen.getByLabelText('Avatar URL'), ' https://example.com/me.png ');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(mockApi.put).toHaveBeenCalledWith('/auth/me', {
        full_name: 'Ada L',
        avatar_url: 'https://example.com/me.png',
      }),
    );
    await waitFor(() => expect(auth.setUser).toHaveBeenCalledWith(updated));
    expect(await screen.findByText('Profile updated')).toBeInTheDocument();
  });

  it('rejects overly long names and resets edits', async () => {
    const { user } = setup();
    const name = screen.getByLabelText('Full name');
    await user.clear(name);
    await user.type(name, 'x'.repeat(101));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Name must be 100 characters or fewer')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(name).toHaveValue('Ada');
  });

  it('shows server errors', async () => {
    mockApi.put.mockRejectedValue(makeAxiosError(422, { detail: 'Avatar URL too long' }));
    const { user } = setup();
    await user.type(screen.getByLabelText('Avatar URL'), 'https://example.com/a.png');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Avatar URL too long');
  });
});
