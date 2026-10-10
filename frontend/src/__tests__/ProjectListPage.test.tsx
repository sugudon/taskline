import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectListPage } from '../pages/projects/ProjectListPage';
import { makeProject, makeUser } from './utils/fixtures';
import { mockApi, resetMockApi } from './utils/apiMock';
import { renderWithProviders } from './utils/render';

vi.mock('../services/api', () => import('./utils/apiMock'));

interface ListConfig {
  params?: { include_archived?: boolean };
}

const active = makeProject({ id: 1, name: 'Active One', member_count: 3 });
const archived = makeProject({ id: 2, name: 'Old Stuff', is_archived: true });

beforeEach(() => {
  resetMockApi();
  mockApi.get.mockImplementation(async (url: string, ...rest: unknown[]) => {
    if (url !== '/projects') throw new Error(`Unexpected GET ${url}`);
    const config = rest[0] as ListConfig | undefined;
    return { data: config?.params?.include_archived ? [active, archived] : [active] };
  });
});

const renderPage = () => renderWithProviders(<ProjectListPage />, { route: '/projects', auth: { user: makeUser() } });

describe('ProjectListPage', () => {
  it('lists active projects and links to them', async () => {
    renderPage();
    expect(await screen.findByText('Active One')).toBeInTheDocument();
    expect(screen.queryByText('Old Stuff')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Active One/ })).toHaveAttribute('href', '/projects/1');
    expect(mockApi.get).toHaveBeenCalledWith('/projects', { params: { include_archived: false } });
  });

  it('includes archived projects when toggled', async () => {
    renderPage();
    await screen.findByText('Active One');
    await userEvent.setup().click(screen.getByLabelText('Show archived'));
    expect(await screen.findByText('Old Stuff')).toBeInTheDocument();
    expect(mockApi.get).toHaveBeenCalledWith('/projects', { params: { include_archived: true } });
  });

  it('shows an empty state that leads to project creation', async () => {
    mockApi.get.mockResolvedValue({ data: [] });
    renderPage();
    expect(await screen.findByText('No active projects')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Create your first project' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/projects/new');
  });

  it('navigates to the create page from the header button', async () => {
    renderPage();
    await screen.findByText('Active One');
    await userEvent.setup().click(screen.getByRole('button', { name: 'New project' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/projects/new');
  });

  it('shows errors', async () => {
    mockApi.get.mockRejectedValue(new Error('Server sad'));
    renderPage();
    expect(await screen.findByText('Server sad')).toBeInTheDocument();
  });
});
