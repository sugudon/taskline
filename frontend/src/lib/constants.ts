import type { AssignmentPriority, AssignmentSort, AssignmentStatus, ProjectRole } from '../types';

export const ASSIGNMENT_STATUSES: AssignmentStatus[] = ['todo', 'in_progress', 'in_review', 'done'];
export const ASSIGNMENT_PRIORITIES: AssignmentPriority[] = ['low', 'medium', 'high', 'urgent'];

export const STATUS_LABELS: Record<AssignmentStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
};

/** Chakra colorScheme per status */
export const STATUS_COLORS: Record<AssignmentStatus, string> = {
  todo: 'gray',
  in_progress: 'blue',
  in_review: 'purple',
  done: 'green',
};

export const PRIORITY_LABELS: Record<AssignmentPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

/** Chakra colorScheme per priority */
export const PRIORITY_COLORS: Record<AssignmentPriority, string> = {
  low: 'gray',
  medium: 'cyan',
  high: 'orange',
  urgent: 'red',
};

export const PRIORITY_ORDER: Record<AssignmentPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  urgent: 3,
};

export const ROLE_LABELS: Record<ProjectRole, string> = {
  owner: 'Owner',
  member: 'Member',
};

export const SORT_OPTIONS: { value: AssignmentSort; label: string }[] = [
  { value: '-created_at', label: 'Newest first' },
  { value: 'created_at', label: 'Oldest first' },
  { value: 'due_date', label: 'Due date (soonest)' },
  { value: '-due_date', label: 'Due date (latest)' },
  { value: '-priority', label: 'Priority (highest)' },
  { value: 'priority', label: 'Priority (lowest)' },
];

export const DEFAULT_PROJECT_COLOR = '#805AD5';
export const PROJECT_COLOR_PRESETS: string[] = [
  '#805AD5',
  '#D53F8C',
  '#3182CE',
  '#38A169',
  '#DD6B20',
  '#E53E3E',
  '#319795',
  '#D69E2E',
];

export const DEFAULT_PAGE_SIZE = 20;
