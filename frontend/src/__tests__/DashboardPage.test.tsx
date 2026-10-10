import { screen, within } from '@testing-library/react';
import { DashboardPage } from '../pages/DashboardPage';
import { makeAssignment, makeDashboard, makeSummary, makeUser } from './utils/fixtures';
import { mockApi, resetMockApi, routeGet } from './utils/apiMock';
import { renderWithProviders } from './utils/render';

vi.mock('../services/api', () => import('./utils/apiMock'));

const isoDaysFromToday = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const statValue = (label: string, value: number): HTMLElement =>
  within(screen.getByTestId(`stat-${label}`)).getByLabelText(String(value));

beforeEach(() => resetMockApi());

describe('DashboardPage', () => {
  it('renders the summary numbers, lists and activity', async () => {
    routeGet({
      '/dashboard/summary': makeDashboard({
        total: 12,
        by_status: { todo: 5, in_progress: 3, in_review: 1, done: 3 },
        overdue_count: 2,
        assigned_to_me_count: 4,
        due_this_week: [makeAssignment({ id: 1, title: 'Due soon task', due_date: isoDaysFromToday(1) })],
        overdue: [
          makeAssignment({ id: 2, title: 'Late task', due_date: isoDaysFromToday(-2), is_overdue: true }),
        ],
        recent_comments: [
          {
            id: 9,
            body: 'Looks good to me',
            created_at: new Date().toISOString(),
            author: makeSummary({ full_name: 'Grace Hopper' }),
            assignment_id: 2,
            assignment_title: 'Late task',
          },
        ],
      }),
    });
    renderWithProviders(<DashboardPage />, { route: '/dashboard', auth: { user: makeUser({ full_name: 'Ada Lovelace' }) } });

    expect(await screen.findByTestId('stat-Total')).toBeInTheDocument();
    expect(statValue('Total', 12)).toBeInTheDocument();
    expect(statValue('In progress', 3)).toBeInTheDocument();
    expect(statValue('Overdue', 2)).toBeInTheDocument();
    expect(statValue('Assigned to me', 4)).toBeInTheDocument();
    expect(screen.getByText('Needs attention')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Welcome back, Ada' })).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument(); // 3 of 12 done
    expect(screen.getByText('5 · 42%')).toBeInTheDocument();
    expect(screen.getByText('Due soon task')).toBeInTheDocument();
    expect(screen.getByText('Due tomorrow')).toBeInTheDocument();
    expect(screen.getAllByText('Late task').length).toBeGreaterThan(0);
    expect(screen.getByText('Looks good to me')).toBeInTheDocument();
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();

    const overdueLink = screen.getByRole('link', { name: 'Overdue' });
    expect(overdueLink).toHaveAttribute('href', '/assignments?overdue=true');
    expect(mockApi.get).toHaveBeenCalledWith('/dashboard/summary');
  });

  it('greets by email prefix when there is no name', async () => {
    routeGet({ '/dashboard/summary': makeDashboard({ total: 1, by_status: { todo: 1, in_progress: 0, in_review: 0, done: 0 } }) });
    renderWithProviders(<DashboardPage />, { auth: { user: makeUser({ full_name: null, email: 'grace@navy.mil' }) } });
    expect(await screen.findByRole('heading', { name: 'Welcome back, grace' })).toBeInTheDocument();
    expect(await screen.findByText('All caught up')).toBeInTheDocument();
  });

  it('shows the empty state when there are no assignments', async () => {
    routeGet({ '/dashboard/summary': makeDashboard() });
    renderWithProviders(<DashboardPage />, { auth: { user: makeUser() } });
    expect(await screen.findByText('No assignments yet')).toBeInTheDocument();
    expect(screen.queryByTestId('stat-Total')).not.toBeInTheDocument();
  });

  it('shows an error with retry when the summary fails', async () => {
    mockApi.get.mockRejectedValue(new Error('Dashboard down'));
    renderWithProviders(<DashboardPage />, { auth: { user: makeUser() } });
    expect(await screen.findByText("Couldn't load dashboard.")).toBeInTheDocument();
    expect(screen.getByText('Dashboard down')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
