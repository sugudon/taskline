import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBar } from '../components/assignments/FilterBar';
import { AssignmentListPage } from '../pages/assignments/AssignmentListPage';
import type { AssignmentFilters, AssignmentPage } from '../types';
import { makeAssignment, makeProject } from './utils/fixtures';
import { mockApi, resetMockApi } from './utils/apiMock';
import { renderWithProviders } from './utils/render';

vi.mock('../services/api', () => import('./utils/apiMock'));

const page = (overrides: Partial<AssignmentPage> = {}): AssignmentPage => ({
  items: [makeAssignment({ id: 1, title: 'Write intro' })],
  total: 45,
  page: 1,
  size: 20,
  pages: 3,
  ...overrides,
});

interface GetConfig {
  params?: Record<string, unknown>;
}

const lastAssignmentParams = (): Record<string, unknown> | undefined => {
  const calls = mockApi.get.mock.calls.filter(([url]) => url === '/assignments');
  const config = calls.at(-1)?.[1] as GetConfig | undefined;
  return config?.params;
};

beforeEach(() => {
  resetMockApi();
  mockApi.get.mockImplementation(async (url: string, config?: unknown) => {
    if (url === '/projects') return { data: [makeProject({ id: 7, name: 'Thesis' })] };
    if (url === '/assignments') {
      const params = (config as GetConfig | undefined)?.params ?? {};
      const current = typeof params.page === 'number' ? params.page : 1;
      return { data: page({ page: current }) };
    }
    throw new Error(`Unexpected GET ${url}`);
  });
});

const location = (): string => screen.getByTestId('location').textContent ?? '';

const renderList = (route = '/assignments') =>
  renderWithProviders(<AssignmentListPage />, { route, path: '/assignments' });

describe('FilterBar <-> URL search params (AssignmentListPage)', () => {
  it('reads initial filters from the URL and sends them to the API', async () => {
    renderList('/assignments?status=in_review&priority=high&mine=true&q=essay&sort=due_date&page=2&project_id=7');
    expect((await screen.findAllByText('Write intro')).length).toBeGreaterThan(0);
    expect(lastAssignmentParams()).toEqual({
      project_id: 7,
      status: 'in_review',
      priority: 'high',
      mine: true,
      q: 'essay',
      sort: 'due_date',
      page: 2,
      size: 20,
    });
    expect(screen.getByLabelText('Filter by status')).toHaveValue('in_review');
    expect(screen.getByLabelText('Filter by priority')).toHaveValue('high');
    expect(screen.getByLabelText('Sort assignments')).toHaveValue('due_date');
    expect(screen.getByLabelText('Search assignments')).toHaveValue('essay');
    await waitFor(() => expect(screen.getByLabelText('Filter by project')).toHaveValue('7'));
    expect(screen.getByLabelText('Assigned to me')).toBeChecked();
  });

  it('ignores invalid URL values', async () => {
    renderList('/assignments?status=bogus&priority=nope&sort=title&page=-3&project_id=abc');
    await screen.findAllByText('Write intro');
    expect(lastAssignmentParams()).toEqual({ sort: '-created_at', page: 1, size: 20 });
  });

  it('writes select changes to the URL and resets to page 1', async () => {
    const user = userEvent.setup();
    renderList('/assignments?page=3');
    await screen.findAllByText('Write intro');

    await user.selectOptions(screen.getByLabelText('Filter by status'), 'done');
    await waitFor(() => expect(location()).toBe('/assignments?status=done'));
    await waitFor(() => expect(lastAssignmentParams()).toMatchObject({ status: 'done', page: 1 }));

    await user.selectOptions(screen.getByLabelText('Filter by priority'), 'urgent');
    await waitFor(() => expect(location()).toBe('/assignments?status=done&priority=urgent'));

    await user.selectOptions(screen.getByLabelText('Sort assignments'), 'priority');
    await waitFor(() => expect(location()).toContain('sort=priority'));

    await user.selectOptions(screen.getByLabelText('Filter by status'), '');
    await waitFor(() => expect(location()).not.toContain('status='));
  });

  it('toggles switches into the URL', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findAllByText('Write intro');
    await user.click(screen.getByLabelText('Overdue'));
    await waitFor(() => expect(location()).toBe('/assignments?overdue=true'));
    await user.click(screen.getByLabelText('Assigned to me'));
    await waitFor(() => expect(location()).toBe('/assignments?mine=true&overdue=true'));
    await user.click(screen.getByLabelText('Overdue'));
    await waitFor(() => expect(location()).toBe('/assignments?mine=true'));
  });

  it('debounces search input into ?q=', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findAllByText('Write intro');
    await user.type(screen.getByLabelText('Search assignments'), '  lab report ');
    await waitFor(() => expect(location()).toBe('/assignments?q=lab+report'));
    await waitFor(() => expect(lastAssignmentParams()).toMatchObject({ q: 'lab report' }));
    await user.clear(screen.getByLabelText('Search assignments'));
    await waitFor(() => expect(location()).toBe('/assignments'));
  });

  it('paginates via the URL', async () => {
    const user = userEvent.setup();
    renderList('/assignments?status=todo');
    await screen.findByText('Page 1 of 3');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(location()).toBe('/assignments?status=todo&page=2'));
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Prev' }));
    await waitFor(() => expect(location()).toBe('/assignments?status=todo'));
  });

  it('clears all filters', async () => {
    const user = userEvent.setup();
    renderList('/assignments?status=todo&q=essay');
    await screen.findAllByText('Write intro');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(location()).toBe('/assignments'));
    await waitFor(() => expect(screen.getByLabelText('Search assignments')).toHaveValue(''));
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('shows a filtered empty state with a clear action', async () => {
    mockApi.get.mockImplementation(async (url: string) =>
      url === '/projects' ? { data: [] } : { data: page({ items: [], total: 0, pages: 0 }) },
    );
    renderList('/assignments?status=done');
    expect(await screen.findByText('No assignments match')).toBeInTheDocument();
  });

  it('shows the error state when loading fails', async () => {
    mockApi.get.mockImplementation(async (url: string) => {
      if (url === '/projects') return { data: [] };
      throw new Error('Server exploded');
    });
    renderList();
    expect(await screen.findByText("Couldn't load assignments")).toBeInTheDocument();
    expect(screen.getByText('Server exploded')).toBeInTheDocument();
  });
});

describe('FilterBar (isolated)', () => {
  it('emits patches for the project select', async () => {
    const onChange = vi.fn<(patch: Partial<AssignmentFilters>) => void>();
    const user = userEvent.setup();
    renderWithProviders(<FilterBar filters={{ sort: '-created_at' }} onChange={onChange} onReset={vi.fn()} />);
    await screen.findByRole('option', { name: 'Thesis' });
    await user.selectOptions(screen.getByLabelText('Filter by project'), '7');
    expect(onChange).toHaveBeenCalledWith({ project_id: 7 });
    await user.selectOptions(screen.getByLabelText('Filter by project'), '');
    expect(onChange).toHaveBeenLastCalledWith({ project_id: undefined });
  });
});
