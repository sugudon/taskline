import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssignmentListPage } from '../pages/assignments/AssignmentListPage';
import type { AssignmentPage } from '../types';
import { makeAssignment, makeUser } from './utils/fixtures';
import { mockApi, resetMockApi } from './utils/apiMock';
import { renderWithProviders } from './utils/render';

vi.mock('../services/api', () => import('./utils/apiMock'));

interface ListConfig {
  params?: { page?: number };
}

const TOTAL_PAGES = 2;

beforeEach(() => {
  resetMockApi();
  mockApi.get.mockImplementation(async (url: string, ...rest: unknown[]) => {
    if (url === '/projects') return { data: [] };
    if (url !== '/assignments') throw new Error(`Unexpected GET ${url}`);
    const page = (rest[0] as ListConfig | undefined)?.params?.page ?? 1;
    const data: AssignmentPage = {
      items: page > TOTAL_PAGES ? [] : [makeAssignment({ id: page, title: `Item on page ${page}` })],
      total: 21,
      page,
      size: 20,
      pages: TOTAL_PAGES,
    };
    return { data };
  });
});

const renderPage = (route: string) =>
  renderWithProviders(<AssignmentListPage />, { route, path: '/assignments', auth: { user: makeUser() } });

describe('AssignmentListPage', () => {
  it('jumps to the last page when the requested page is past the end', async () => {
    renderPage('/assignments?page=5');
    expect((await screen.findAllByText('Item on page 2')).length).toBeGreaterThan(0);
    expect(screen.getByTestId('location')).toHaveTextContent('/assignments?page=2');
    expect(screen.queryByText('No assignments match')).not.toBeInTheDocument();
  });

  it('pages forward', async () => {
    renderPage('/assignments');
    expect((await screen.findAllByText('Item on page 1')).length).toBeGreaterThan(0);
    await userEvent.setup().click(screen.getByRole('button', { name: /Next/ }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/assignments?page=2'));
    expect((await screen.findAllByText('Item on page 2')).length).toBeGreaterThan(0);
  });
});
