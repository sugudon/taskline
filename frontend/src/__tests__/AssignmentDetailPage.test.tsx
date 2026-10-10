import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssignmentDetailPage } from '../pages/assignments/AssignmentDetailPage';
import type { AssignmentResponse, CommentResponse, ProjectDetail } from '../types';
import { makeAssignment, makeAxiosError, makeMember, makeProject, makeSummary, makeUser } from './utils/fixtures';
import { mockApi, resetMockApi } from './utils/apiMock';
import { renderWithProviders } from './utils/render';

vi.mock('../services/api', () => import('./utils/apiMock'));

const ada = makeSummary({ id: 1, full_name: 'Ada Lovelace' });
const bob = makeSummary({ id: 2, full_name: 'Bob Builder', email: 'bob@example.com' });

const makeComment = (overrides: Partial<CommentResponse> = {}): CommentResponse => ({
  id: 1,
  assignment_id: 5,
  author: ada,
  body: 'Nice work',
  created_at: new Date().toISOString(),
  updated_at: null,
  ...overrides,
});

interface Setup {
  assignment?: AssignmentResponse | Error;
  project?: Partial<ProjectDetail>;
  comments?: CommentResponse[];
}

const setup = ({ assignment = makeAssignment({ id: 5 }), project = {}, comments = [] }: Setup = {}) => {
  mockApi.get.mockImplementation(async (url: string) => {
    if (url === '/assignments/5') {
      if (assignment instanceof Error) throw assignment;
      return { data: assignment };
    }
    if (url === '/assignments/5/comments') return { data: comments };
    if (url === '/projects/1') {
      return { data: { ...makeProject({ id: 1, owner_id: 1 }), members: [makeMember(ada), makeMember(bob)], ...project } };
    }
    if (url === '/projects/1/members') return { data: [makeMember(ada), makeMember(bob)] };
    throw new Error(`Unexpected GET ${url}`);
  });
};

const renderPage = (userId = 1, route = '/assignments/5') =>
  renderWithProviders(<AssignmentDetailPage />, {
    route,
    path: '/assignments/:id',
    auth: { user: makeUser({ id: userId }) },
  });

beforeEach(() => resetMockApi());

describe('AssignmentDetailPage', () => {
  it('renders the assignment with comments and creator actions', async () => {
    setup({
      assignment: makeAssignment({ id: 5, title: 'Write intro', description: 'Two pages', comment_count: 2 }),
      comments: [makeComment(), makeComment({ id: 2, author: bob, body: 'Agreed' })],
    });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Write intro' })).toBeInTheDocument();
    expect(screen.getByText('Two pages')).toBeInTheDocument();
    expect(await screen.findByText('Nice work')).toBeInTheDocument();
    expect(screen.getByText('Agreed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    // Only own comments can be deleted.
    expect(screen.getAllByRole('button', { name: 'Delete comment' })).toHaveLength(1);
  });

  it('changes the status through the status endpoint', async () => {
    setup();
    mockApi.patch.mockResolvedValue({ data: makeAssignment({ id: 5, status: 'in_progress' }) });
    renderPage();
    const select = await screen.findByLabelText('Status');
    await userEvent.setup().selectOptions(select, 'in_progress');
    await waitFor(() =>
      expect(mockApi.patch).toHaveBeenCalledWith('/assignments/5/status', { status: 'in_progress' }),
    );
    expect(await screen.findByText('Moved to In Progress')).toBeInTheDocument();
  });

  it('changes the assignee through the assignee endpoint', async () => {
    setup();
    mockApi.patch.mockResolvedValue({ data: makeAssignment({ id: 5, assignee: bob }) });
    renderPage();
    const select = await screen.findByLabelText('Assignee');
    await waitFor(() => expect(within(select).getByRole('option', { name: 'Bob Builder' })).toBeInTheDocument());
    await userEvent.setup().selectOptions(select, '2');
    await waitFor(() => expect(mockApi.patch).toHaveBeenCalledWith('/assignments/5/assignee', { assignee_id: 2 }));
  });

  it('renders "Deleted user" for a deleted creator and comment author', async () => {
    setup({
      assignment: makeAssignment({ id: 5, created_by: null }),
      comments: [makeComment({ author: null, body: 'Orphaned comment' })],
    });
    renderPage(2);
    expect(await screen.findByText('Orphaned comment')).toBeInTheDocument();
    expect(screen.getAllByText('Deleted user').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByLabelText('Deleted user').length).toBeGreaterThanOrEqual(2);
    // A null creator never matches the current user, and nobody can delete the orphaned comment.
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete comment' })).not.toBeInTheDocument();
  });

  it('disables status, assignee and comments on archived projects', async () => {
    setup({ project: { is_archived: true } });
    renderPage();
    expect(await screen.findByTestId('archived-comment-note')).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeDisabled();
    expect(screen.getByLabelText('Assignee')).toBeDisabled();
    expect(screen.getByLabelText('Add a comment')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Post comment' })).toBeDisabled();
    expect(screen.getByText(/status and assignee can no longer be changed/)).toBeInTheDocument();
  });

  it('posts a comment', async () => {
    setup();
    mockApi.post.mockResolvedValue({ data: makeComment({ id: 9, body: 'Hello' }) });
    renderPage();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Add a comment'), 'Hello');
    await user.click(screen.getByRole('button', { name: 'Post comment' }));
    await waitFor(() => expect(mockApi.post).toHaveBeenCalledWith('/assignments/5/comments', { body: 'Hello' }));
  });

  it('deletes the assignment after confirmation', async () => {
    setup();
    mockApi.delete.mockResolvedValue({ data: null });
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(mockApi.delete).toHaveBeenCalledWith('/assignments/5'));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/assignments$/));
  });

  it('shows not found for 404s', async () => {
    setup({ assignment: makeAxiosError(404, { detail: 'Assignment not found' }) });
    renderPage();
    expect(await screen.findByText('Assignment not found')).toBeInTheDocument();
  });

  it('shows not found for a non-numeric id', () => {
    renderPage(1, '/assignments/abc');
    expect(screen.getByText('Assignment not found')).toBeInTheDocument();
  });

  it('shows other load errors', async () => {
    setup({ assignment: makeAxiosError(403, { detail: 'Kaboom' }) });
    renderPage();
    expect(await screen.findByText('Kaboom')).toBeInTheDocument();
  });
});
