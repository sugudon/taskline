import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import type {
  AssignmentResponse,
  DashboardSummary,
  ProjectMemberResponse,
  ProjectResponse,
  UserResponse,
  UserSummary,
} from '../../types';

export const makeUser = (overrides: Partial<UserResponse> = {}): UserResponse => ({
  id: 1,
  email: 'ada@example.com',
  full_name: 'Ada Lovelace',
  avatar_url: null,
  is_active: true,
  is_verified: false,
  oauth_provider: null,
  has_password: true,
  created_at: '2025-01-01T00:00:00Z',
  ...overrides,
});

export const makeSummary = (overrides: Partial<UserSummary> = {}): UserSummary => ({
  id: 1,
  email: 'ada@example.com',
  full_name: 'Ada Lovelace',
  avatar_url: null,
  ...overrides,
});

export const makeProject = (overrides: Partial<ProjectResponse> = {}): ProjectResponse => ({
  id: 1,
  owner_id: 1,
  name: 'Thesis',
  description: null,
  color: '#805AD5',
  is_archived: false,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: null,
  member_count: 1,
  assignment_count: 0,
  open_assignment_count: 0,
  ...overrides,
});

export const makeMember = (user: UserSummary, id = user.id): ProjectMemberResponse => ({
  id,
  user,
  role: 'member',
  joined_at: '2025-01-01T00:00:00Z',
});

export const makeAssignment = (overrides: Partial<AssignmentResponse> = {}): AssignmentResponse => ({
  id: 1,
  project_id: 1,
  project_name: 'Thesis',
  title: 'Write intro',
  description: null,
  status: 'todo',
  priority: 'medium',
  due_date: null,
  completed_at: null,
  created_by: makeSummary(),
  assignee: null,
  is_overdue: false,
  comment_count: 0,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: null,
  ...overrides,
});

export const makeDashboard = (overrides: Partial<DashboardSummary> = {}): DashboardSummary => ({
  total: 0,
  by_status: { todo: 0, in_progress: 0, in_review: 0, done: 0 },
  overdue_count: 0,
  assigned_to_me_count: 0,
  my_assignments: [],
  due_this_week: [],
  overdue: [],
  recent_comments: [],
  ...overrides,
});

/** An AxiosError carrying a FastAPI-style error body. */
export const makeAxiosError = (status: number, data: unknown): AxiosError => {
  const config: InternalAxiosRequestConfig = { headers: new AxiosHeaders() };
  const response: AxiosResponse = { data, status, statusText: String(status), headers: {}, config };
  return new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST', config, null, response);
};
