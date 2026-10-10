import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssignmentForm } from '../components/assignments/AssignmentForm';
import type { AssignmentFormValues } from '../components/assignments/utils';
import { makeMember, makeProject, makeSummary } from './utils/fixtures';
import { mockApi, resetMockApi } from './utils/apiMock';
import { renderWithProviders } from './utils/render';

vi.mock('../services/api', () => import('./utils/apiMock'));

const EMPTY: AssignmentFormValues = {
  project_id: '',
  title: '',
  description: '',
  priority: 'medium',
  status: 'todo',
  due_date: '',
  assignee_id: '',
};

const alice = makeSummary({ id: 11, email: 'alice@example.com', full_name: 'Alice' });
const bob = makeSummary({ id: 12, email: 'bob@example.com', full_name: null });
const carol = makeSummary({ id: 13, email: 'carol@example.com', full_name: 'Carol' });

beforeEach(() => {
  resetMockApi();
  mockApi.get.mockImplementation(async (url: string) => {
    if (url === '/projects') {
      return { data: [makeProject({ id: 1, name: 'Alpha' }), makeProject({ id: 2, name: 'Beta' })] };
    }
    if (url === '/projects/1/members') return { data: [makeMember(alice), makeMember(bob)] };
    if (url === '/projects/2/members') return { data: [makeMember(carol)] };
    throw new Error(`Unexpected GET ${url}`);
  });
});

const setup = (mode: 'create' | 'edit' = 'create', initialValues: AssignmentFormValues = EMPTY) => {
  const onSubmit = vi.fn<(values: AssignmentFormValues) => void>();
  const onCancel = vi.fn<() => void>();
  renderWithProviders(
    <AssignmentForm mode={mode} initialValues={initialValues} onSubmit={onSubmit} onCancel={onCancel} lockedProjectName="Alpha" />,
  );
  return { onSubmit, onCancel, user: userEvent.setup() };
};

const assigneeOptions = (): string[] =>
  within(screen.getByLabelText('Assignee'))
    .getAllByRole('option')
    .map((o) => o.textContent ?? '');

describe('AssignmentForm', () => {
  it('validates project and title', async () => {
    const { user, onSubmit } = setup();
    await user.click(screen.getByRole('button', { name: 'Create assignment' }));
    expect(await screen.findByText('Pick a project')).toBeInTheDocument();
    expect(screen.getByText('Title is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables the assignee picker until a project is chosen', async () => {
    setup();
    expect(await screen.findByRole('option', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.getByLabelText('Assignee')).toBeDisabled();
    expect(screen.getByText('Select a project to choose an assignee.')).toBeInTheDocument();
  });

  it('loads members per project and resets the assignee when the project changes', async () => {
    const { user, onSubmit } = setup();
    await screen.findByRole('option', { name: 'Alpha' });

    await user.selectOptions(screen.getByLabelText(/^project/i), '1');
    await waitFor(() => expect(assigneeOptions()).toEqual(['Unassigned', 'Alice', 'bob@example.com']));
    await user.selectOptions(screen.getByLabelText('Assignee'), '11');
    expect(screen.getByLabelText('Assignee')).toHaveValue('11');

    await user.selectOptions(screen.getByLabelText(/^project/i), '2');
    expect(screen.getByLabelText('Assignee')).toHaveValue('');
    await waitFor(() => expect(assigneeOptions()).toEqual(['Unassigned', 'Carol']));
    expect(mockApi.get).toHaveBeenCalledWith('/projects/2/members');

    await user.type(screen.getByLabelText(/^title/i), 'Essay');
    await user.click(screen.getByRole('button', { name: 'Create assignment' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: '2', assignee_id: '', title: 'Essay' }),
    );
  });

  it('submits all chosen fields', async () => {
    const { user, onSubmit } = setup();
    await screen.findByRole('option', { name: 'Alpha' });
    await user.selectOptions(screen.getByLabelText(/^project/i), '1');
    await waitFor(() => expect(assigneeOptions()).toContain('Alice'));
    await user.selectOptions(screen.getByLabelText('Assignee'), '11');
    await user.type(screen.getByLabelText(/^title/i), 'Lab');
    await user.type(screen.getByLabelText('Description'), 'Details');
    await user.selectOptions(screen.getByLabelText('Priority'), 'urgent');
    await user.selectOptions(screen.getByLabelText('Status'), 'in_progress');
    await user.type(screen.getByLabelText('Due date'), '2030-05-01');
    await user.click(screen.getByRole('button', { name: 'Create assignment' }));
    expect(onSubmit).toHaveBeenCalledWith({
      project_id: '1',
      title: 'Lab',
      description: 'Details',
      priority: 'urgent',
      status: 'in_progress',
      due_date: '2030-05-01',
      assignee_id: '11',
    });
  });

  it('locks the project and hides status/assignee in edit mode', async () => {
    const { user, onCancel } = setup('edit', { ...EMPTY, project_id: '1', title: 'Existing' });
    expect(screen.getByLabelText('Project')).toHaveValue('Alpha');
    expect(screen.getByLabelText('Project')).toBeDisabled();
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Assignee')).not.toBeInTheDocument();
    expect(mockApi.get).not.toHaveBeenCalledWith('/projects/1/members');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('never offers archived projects as a target', async () => {
    mockApi.get.mockImplementation(async (url: string) => {
      if (url === '/projects') {
        return { data: [makeProject({ id: 1, name: 'Alpha' }), makeProject({ id: 3, name: 'Frozen', is_archived: true })] };
      }
      throw new Error(`Unexpected GET ${url}`);
    });
    setup();
    expect(await screen.findByRole('option', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Frozen' })).not.toBeInTheDocument();
  });

  it('tells the user to create a project when they have none', async () => {
    mockApi.get.mockResolvedValue({ data: [] });
    setup();
    expect(await screen.findByText(/You need a project first/)).toBeInTheDocument();
  });
});
