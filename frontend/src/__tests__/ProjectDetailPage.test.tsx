import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectDetailPage } from '../pages/projects/ProjectDetailPage';
import type { ProjectDetail } from '../types';
import { makeAssignment, makeAxiosError, makeMember, makeProject, makeSummary, makeUser } from './utils/fixtures';
import { mockApi, resetMockApi } from './utils/apiMock';
import { renderWithProviders } from './utils/render';

vi.mock('../services/api', () => import('./utils/apiMock'));

const owner = makeSummary({ id: 1, full_name: 'Ada Owner', email: 'ada@example.com' });
const member = makeSummary({ id: 2, full_name: 'Bob Member', email: 'bob@example.com' });

const makeDetail = (overrides: Partial<ProjectDetail> = {}): ProjectDetail => ({
  ...makeProject({ id: 7, name: 'Compilers', owner_id: 1, member_count: 2 }),
  members: [{ ...makeMember(owner), role: 'owner' }, makeMember(member)],
  ...overrides,
});

const mockProject = (detail: ProjectDetail | Error): void => {
  mockApi.get.mockImplementation(async (url: string) => {
    if (url === '/projects/7') {
      if (detail instanceof Error) throw detail;
      return { data: detail };
    }
    if (url === '/assignments') {
      return {
        data: {
          items: [
            makeAssignment({ id: 3, title: 'Lexer', status: 'todo', assignee: member }),
            makeAssignment({ id: 4, title: 'Parser', status: 'done' }),
          ],
          total: 2,
          page: 1,
          size: 100,
          pages: 1,
        },
      };
    }
    throw new Error(`Unexpected GET ${url}`);
  });
};

const renderPage = (userId: number) =>
  renderWithProviders(<ProjectDetailPage />, {
    route: '/projects/7',
    path: '/projects/:id',
    auth: { user: makeUser({ id: userId }) },
  });

beforeEach(() => resetMockApi());

describe('ProjectDetailPage', () => {
  it('gives the owner edit/delete controls, the add-member form and the board', async () => {
    mockProject(makeDetail());
    renderPage(1);
    expect(await screen.findByRole('heading', { name: 'Compilers' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add member' })).toBeInTheDocument();
    expect(screen.queryByTestId('archived-banner')).not.toBeInTheDocument();
    expect(await screen.findByText('Lexer')).toBeInTheDocument();
    expect(within(screen.getByTestId('board-column-done')).getByText('Parser')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'New assignment' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/assignments/new?project_id=7');
  });

  it('hides owner-only controls from plain members', async () => {
    mockProject(makeDetail());
    renderPage(2);
    expect(await screen.findByRole('heading', { name: 'Compilers' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Add member' })).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'New assignment' })).toBeInTheDocument();
  });

  it('shows an archived banner and hides creation controls on archived projects', async () => {
    mockProject(makeDetail({ is_archived: true }));
    renderPage(1);
    expect(await screen.findByTestId('archived-banner')).toHaveTextContent('Archived');
    expect(screen.queryByRole('button', { name: 'New assignment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Add member' })).not.toBeInTheDocument();
    // Owner can still edit (to unarchive).
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('deletes the project after confirmation', async () => {
    mockProject(makeDetail());
    mockApi.delete.mockResolvedValue({ data: null });
    renderPage(1);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(mockApi.delete).toHaveBeenCalledWith('/projects/7');
    expect(await screen.findByTestId('location')).toHaveTextContent('/projects');
  });

  it('shows not-found for a 404', async () => {
    mockProject(makeAxiosError(404, { detail: 'Project not found' }));
    renderPage(1);
    expect(await screen.findByText('Project not found')).toBeInTheDocument();
  });

  it('shows not-found for a non-numeric id without fetching', () => {
    renderWithProviders(<ProjectDetailPage />, { route: '/projects/abc', path: '/projects/:id' });
    expect(screen.getByText('Project not found')).toBeInTheDocument();
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it('shows other errors inline', async () => {
    mockProject(makeAxiosError(500, { detail: 'Database exploded' }));
    renderPage(1);
    expect(await screen.findByText('Database exploded')).toBeInTheDocument();
  });
});
