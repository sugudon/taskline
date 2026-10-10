import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssignmentCreatePage } from '../pages/assignments/AssignmentCreatePage';
import { makeAssignment, makeAxiosError, makeMember, makeProject, makeSummary, makeUser } from './utils/fixtures';
import { mockApi, resetMockApi } from './utils/apiMock';
import { renderWithProviders } from './utils/render';

vi.mock('../services/api', () => import('./utils/apiMock'));

beforeEach(() => {
  resetMockApi();
  mockApi.get.mockImplementation(async (url: string) => {
    if (url === '/projects') {
      return { data: [makeProject({ id: 1, name: 'Alpha' }), makeProject({ id: 2, name: 'Beta' })] };
    }
    if (url === '/projects/1/members') return { data: [makeMember(makeSummary({ id: 1 }))] };
    if (url === '/projects/2/members') return { data: [makeMember(makeSummary({ id: 1 }))] };
    throw new Error(`Unexpected GET ${url}`);
  });
});

const renderPage = (route: string) =>
  renderWithProviders(<AssignmentCreatePage />, {
    route,
    path: '/assignments/new',
    routes: { '/assignments/:id': <div>detail page</div> },
    auth: { user: makeUser() },
  });

describe('AssignmentCreatePage', () => {
  it('prefills the project from ?project_id and creates the assignment', async () => {
    mockApi.post.mockResolvedValue({ data: makeAssignment({ id: 42, project_id: 2 }) });
    renderPage('/assignments/new?project_id=2');
    await screen.findByRole('option', { name: 'Beta' });
    expect(screen.getByLabelText(/^project/i)).toHaveValue('2');

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^title/i), '  Lab report  ');
    await user.click(screen.getByRole('button', { name: 'Create assignment' }));

    await waitFor(() =>
      expect(mockApi.post).toHaveBeenCalledWith('/assignments', {
        project_id: 2,
        title: 'Lab report',
        description: null,
        priority: 'medium',
        status: 'todo',
        due_date: null,
        assignee_id: null,
      }),
    );
    expect(await screen.findByText('detail page')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/assignments/42');
  });

  it('ignores a malformed project_id', async () => {
    renderPage('/assignments/new?project_id=abc');
    await screen.findByRole('option', { name: 'Alpha' });
    expect(screen.getByLabelText(/^project/i)).toHaveValue('');
  });

  it('shows the server error (e.g. archived project) and stays on the page', async () => {
    mockApi.post.mockRejectedValue(makeAxiosError(409, { detail: 'Project is archived', code: 'CONFLICT' }));
    renderPage('/assignments/new?project_id=1');
    await screen.findByRole('option', { name: 'Alpha' });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^title/i), 'Essay');
    await user.click(screen.getByRole('button', { name: 'Create assignment' }));
    expect(await screen.findByText('Project is archived')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/assignments/new');
  });
});
