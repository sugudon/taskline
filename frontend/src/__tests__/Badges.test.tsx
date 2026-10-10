import { screen } from '@testing-library/react';
import { PriorityBadge } from '../components/ui/PriorityBadge';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ASSIGNMENT_PRIORITIES, ASSIGNMENT_STATUSES, PRIORITY_LABELS, STATUS_LABELS } from '../lib/constants';
import type { AssignmentPriority, AssignmentStatus } from '../types';
import { renderWithProviders } from './utils/render';

describe('StatusBadge', () => {
  it.each<[AssignmentStatus, string]>([
    ['todo', 'To Do'],
    ['in_progress', 'In Progress'],
    ['in_review', 'In Review'],
    ['done', 'Done'],
  ])('renders %s as "%s"', (status, label) => {
    renderWithProviders(<StatusBadge status={status} />);
    const badge = screen.getByText(label);
    expect(badge).toHaveAttribute('data-status', status);
  });

  it('has a label for every status', () => {
    expect(ASSIGNMENT_STATUSES.every((s) => STATUS_LABELS[s].length > 0)).toBe(true);
  });

  it('forwards extra badge props', () => {
    renderWithProviders(<StatusBadge status="done" data-testid="badge" />);
    expect(screen.getByTestId('badge')).toHaveTextContent('Done');
  });
});

describe('PriorityBadge', () => {
  it.each<[AssignmentPriority, string]>([
    ['low', 'Low'],
    ['medium', 'Medium'],
    ['high', 'High'],
    ['urgent', 'Urgent'],
  ])('renders %s as "%s"', (priority, label) => {
    renderWithProviders(<PriorityBadge priority={priority} />);
    expect(screen.getByText(label)).toHaveAttribute('data-priority', priority);
  });

  it('has a label for every priority', () => {
    expect(ASSIGNMENT_PRIORITIES.every((p) => PRIORITY_LABELS[p].length > 0)).toBe(true);
  });
});
