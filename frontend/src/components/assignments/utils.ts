import { ASSIGNMENT_PRIORITIES, ASSIGNMENT_STATUSES, SORT_OPTIONS } from '../../lib/constants';
import type {
  AssignmentFilters,
  AssignmentPriority,
  AssignmentSort,
  AssignmentStatus,
  UserSummary,
} from '../../types';

export const DEFAULT_SORT: AssignmentSort = '-created_at';

export const DELETED_USER_LABEL = 'Deleted user';

/** Display name for a user; `null` means the account was deleted. */
export const userDisplayName = (user: UserSummary | null): string =>
  user ? user.full_name?.trim() || user.email : DELETED_USER_LABEL;

/** Parse a YYYY-MM-DD date as a local calendar date (avoids UTC off-by-one). */
const parseDateOnly = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

export const formatDueDate = (value: string | null): string => {
  if (!value) return '—';
  const date = parseDateOnly(value);
  if (!date) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export const formatDateTime = (value: string): string =>
  new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const RELATIVE_UNITS: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
  { unit: 'year', seconds: 31536000 },
  { unit: 'month', seconds: 2592000 },
  { unit: 'week', seconds: 604800 },
  { unit: 'day', seconds: 86400 },
  { unit: 'hour', seconds: 3600 },
  { unit: 'minute', seconds: 60 },
];

export const formatRelativeTime = (value: string, now: number = Date.now()): string => {
  const diffSeconds = (new Date(value).getTime() - now) / 1000;
  const abs = Math.abs(diffSeconds);
  if (abs < 45) return 'just now';
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const match = RELATIVE_UNITS.find((u) => abs >= u.seconds) ?? RELATIVE_UNITS[RELATIVE_UNITS.length - 1];
  return rtf.format(Math.round(diffSeconds / match.seconds), match.unit);
};

// ---------- URL <-> filters ----------

const isStatus = (v: string | null): v is AssignmentStatus =>
  v !== null && (ASSIGNMENT_STATUSES as string[]).includes(v);
const isPriority = (v: string | null): v is AssignmentPriority =>
  v !== null && (ASSIGNMENT_PRIORITIES as string[]).includes(v);
const isSort = (v: string | null): v is AssignmentSort =>
  v !== null && SORT_OPTIONS.some((o) => o.value === v);

const parsePositiveInt = (v: string | null): number | undefined => {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

export const filtersFromSearchParams = (params: URLSearchParams): AssignmentFilters => {
  const status = params.get('status');
  const priority = params.get('priority');
  const sort = params.get('sort');
  const q = params.get('q')?.trim();
  return {
    project_id: parsePositiveInt(params.get('project_id')),
    status: isStatus(status) ? status : undefined,
    priority: isPriority(priority) ? priority : undefined,
    mine: params.get('mine') === 'true' || undefined,
    overdue: params.get('overdue') === 'true' || undefined,
    q: q || undefined,
    sort: isSort(sort) ? sort : DEFAULT_SORT,
    page: parsePositiveInt(params.get('page')) ?? 1,
  };
};

export const filtersToSearchParams = (filters: AssignmentFilters): URLSearchParams => {
  const params = new URLSearchParams();
  if (filters.project_id) params.set('project_id', String(filters.project_id));
  if (filters.status) params.set('status', filters.status);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.mine) params.set('mine', 'true');
  if (filters.overdue) params.set('overdue', 'true');
  if (filters.q) params.set('q', filters.q);
  if (filters.sort && filters.sort !== DEFAULT_SORT) params.set('sort', filters.sort);
  if (filters.page && filters.page > 1) params.set('page', String(filters.page));
  return params;
};

// ---------- Form ----------

export interface AssignmentFormValues {
  project_id: string;
  title: string;
  description: string;
  priority: AssignmentPriority;
  status: AssignmentStatus;
  due_date: string;
  assignee_id: string;
}

export type AssignmentFormErrors = Partial<Record<keyof AssignmentFormValues, string>>;

export const TITLE_MAX = 200;
export const COMMENT_MAX = 5000;

export const validateAssignmentForm = (values: AssignmentFormValues): AssignmentFormErrors => {
  const errors: AssignmentFormErrors = {};
  if (!values.project_id) errors.project_id = 'Pick a project';
  const title = values.title.trim();
  if (!title) errors.title = 'Title is required';
  else if (title.length > TITLE_MAX) errors.title = `Title must be at most ${TITLE_MAX} characters`;
  if (values.due_date && !parseDateOnly(values.due_date)) errors.due_date = 'Enter a valid date';
  return errors;
};
