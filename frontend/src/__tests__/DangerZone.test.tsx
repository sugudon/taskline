import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DangerZone } from '../components/settings/DangerZone';
import { makeAxiosError, makeUser } from './utils/fixtures';
import { mockApi, resetMockApi } from './utils/apiMock';
import { renderWithProviders } from './utils/render';

vi.mock('../services/api', () => import('./utils/apiMock'));

beforeEach(() => resetMockApi());

const openAndConfirm = async () => {
  const result = renderWithProviders(<DangerZone />, {
    route: '/settings',
    routes: { '/login': <div>login page</div> },
    auth: { user: makeUser() },
  });
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Delete account' }));
  const dialog = await screen.findByRole('alertdialog');
  await user.click(within(dialog).getByRole('button', { name: 'Delete account' }));
  expect((await within(dialog).findAllByText('Type DELETE to confirm')).length).toBeGreaterThan(1);
  await user.type(within(dialog).getByRole('textbox'), 'DELETE');
  await user.click(within(dialog).getByRole('button', { name: 'Delete account' }));
  return { ...result, dialog };
};

describe('DangerZone', () => {
  it('deletes the account, logs out and goes to login', async () => {
    mockApi.delete.mockResolvedValue({ data: null });
    const { auth } = await openAndConfirm();
    await waitFor(() => expect(mockApi.delete).toHaveBeenCalledWith('/auth/me'));
    await waitFor(() => expect(auth.logout).toHaveBeenCalled());
    expect(await screen.findByText('login page')).toBeInTheDocument();
  });

  it('shows the 409 message and stays signed in when shared projects are owned', async () => {
    const detail = 'Transfer or delete the projects you share with others before deleting your account.';
    mockApi.delete.mockRejectedValue(makeAxiosError(409, { detail, code: 'CONFLICT' }));
    const { auth, dialog } = await openAndConfirm();
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(detail);
    expect(auth.logout).not.toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent('/settings');
  });
});
