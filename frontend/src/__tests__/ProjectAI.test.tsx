import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectDetailPage } from '../pages/projects/ProjectDetailPage';
import type { AIStatus, PlanDraft, ProjectDetail, ProjectReport } from '../types';
import { makeAxiosError, makeMember, makeProject, makeSummary, makeUser } from './utils/fixtures';
import { mockApi, resetMockApi } from './utils/apiMock';
import { renderWithProviders } from './utils/render';

vi.mock('../services/api', () => import('./utils/apiMock'));

const owner = makeSummary({ id: 1, full_name: 'Ada Owner', email: 'ada@example.com' });
const member = makeSummary({ id: 2, full_name: 'Bob Member', email: 'bob@example.com' });

const detail = (overrides: Partial<ProjectDetail> = {}): ProjectDetail => ({
  ...makeProject({ id: 7, name: 'Compilers', owner_id: 1, member_count: 2 }),
  members: [{ ...makeMember(owner), role: 'owner' }, makeMember(member)],
  ...overrides,
});

const status = (enabled: boolean): AIStatus => ({
  enabled,
  daily_limit: 30,
  used_today: 0,
  remaining_today: 30,
});

const mockGets = (project: ProjectDetail, ai: AIStatus): void => {
  mockApi.get.mockImplementation(async (url: string) => {
    if (url === '/projects/7') return { data: project };
    if (url === '/ai/status') return { data: ai };
    if (url === '/assignments') {
      return { data: { items: [], total: 0, page: 1, size: 100, pages: 0 } };
    }
    throw new Error(`Unexpected GET ${url}`);
  });
};

const renderPage = () =>
  renderWithProviders(<ProjectDetailPage />, {
    route: '/projects/7',
    path: '/projects/:id',
    auth: { user: makeUser({ id: 1 }) },
  });

const draft: PlanDraft = {
  items: [
    {
      title: 'Write lexer',
      description: 'Tokenize input.',
      priority: 'high',
      due_date: '2026-10-20',
      assignee_id: 2,
      rationale: 'Everything depends on it.',
    },
    {
      title: 'Write parser',
      description: null,
      priority: 'medium',
      due_date: null,
      assignee_id: null,
      rationale: null,
    },
  ],
  notes: 'Start with the lexer.',
};

const report: ProjectReport = {
  headline: 'Mostly on track.',
  completed: ['Lexer'],
  in_progress: [],
  at_risk: ['Parser is overdue'],
  next_steps: ['Pair on the parser'],
  workload: [],
  generated_at: '2026-10-10T10:00:00Z',
};

beforeEach(() => resetMockApi());

describe('Project AI features', () => {
  it('hides AI controls when AI is disabled', async () => {
    mockGets(detail(), status(false));
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Compilers' })).toBeInTheDocument();
    await waitFor(() => expect(mockApi.get).toHaveBeenCalledWith('/ai/status'));
    expect(screen.queryByRole('button', { name: /Plan with AI/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId('ai-report')).not.toBeInTheDocument();
  });

  it('hides planning on archived projects but keeps the report', async () => {
    mockGets(detail({ is_archived: true }), status(true));
    renderPage();
    expect(await screen.findByTestId('ai-report')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Plan with AI/ })).not.toBeInTheDocument();
  });

  it('drafts a plan, lets the user edit it, and applies the selected items', async () => {
    mockGets(detail(), status(true));
    mockApi.post.mockImplementation(async (url: string) => {
      if (url === '/ai/projects/7/plan') return { data: draft };
      if (url === '/ai/projects/7/plan/apply') return { data: [{ id: 1 }] };
      throw new Error(`Unexpected POST ${url}`);
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /Plan with AI/ }));
    const dialog = await screen.findByRole('dialog');
    const draftButton = within(dialog).getByRole('button', { name: 'Draft plan' });
    expect(draftButton).toBeDisabled();
    await user.type(within(dialog).getByRole('textbox'), 'Build a compiler');
    await user.click(draftButton);

    expect(mockApi.post).toHaveBeenCalledWith('/ai/projects/7/plan', {
      goal: 'Build a compiler',
      deadline: null,
      max_items: 8,
    });
    expect(await within(dialog).findByText('Start with the lexer.')).toBeInTheDocument();
    expect(within(dialog).getAllByTestId('plan-row')).toHaveLength(2);
    expect(within(dialog).getByText('Why: Everything depends on it.')).toBeInTheDocument();

    const titles = within(dialog).getAllByRole('textbox', { name: 'Title' });
    await user.clear(titles[0]);
    await user.type(titles[0], 'Write the lexer');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Include Write parser' }));
    await user.click(within(dialog).getByRole('button', { name: 'Add 1 assignment' }));

    await waitFor(() =>
      expect(mockApi.post).toHaveBeenCalledWith('/ai/projects/7/plan/apply', {
        items: [
          {
            title: 'Write the lexer',
            description: 'Tokenize input.',
            priority: 'high',
            due_date: '2026-10-20',
            assignee_id: 2,
          },
        ],
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows the API error when drafting fails', async () => {
    mockGets(detail(), status(true));
    mockApi.post.mockRejectedValue(
      makeAxiosError(429, { detail: 'Daily AI limit reached (30 requests).', code: 'AI_QUOTA_EXCEEDED' }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /Plan with AI/ }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), 'Build a compiler');
    await user.click(within(dialog).getByRole('button', { name: 'Draft plan' }));
    expect(await within(dialog).findByText(/Daily AI limit reached/)).toBeInTheDocument();
  });

  it('generates and renders a status report', async () => {
    mockGets(detail(), status(true));
    mockApi.post.mockResolvedValue({ data: report });
    const user = userEvent.setup();
    renderPage();

    const panel = await screen.findByTestId('ai-report');
    await user.click(within(panel).getByRole('button', { name: 'Summarize' }));
    expect(await within(panel).findByText('Mostly on track.')).toBeInTheDocument();
    expect(within(panel).getByText('Parser is overdue')).toBeInTheDocument();
    expect(within(panel).getByText('At risk')).toBeInTheDocument();
    expect(within(panel).queryByText('Workload')).not.toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    expect(mockApi.post).toHaveBeenCalledWith('/ai/projects/7/report');
  });
});
