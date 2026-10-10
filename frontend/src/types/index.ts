// Shared types — MUST match PRPs/taskline-contract.md exactly.

// ---------- Enums ----------
export type AssignmentStatus = 'todo' | 'in_progress' | 'in_review' | 'done';
export type AssignmentPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ProjectRole = 'owner' | 'member';
export type AssignmentSort =
  | 'due_date'
  | '-due_date'
  | 'created_at'
  | '-created_at'
  | 'priority'
  | '-priority';

// ---------- Users / Auth ----------
export interface UserResponse {
  id: number;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_verified: boolean;
  oauth_provider: string | null;
  has_password: boolean;
  created_at: string;
}

export interface UserSummary {
  id: number;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface Token {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name?: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface LogoutRequest {
  refresh_token: string;
}

export interface UserUpdate {
  full_name?: string;
  avatar_url?: string | null;
}

export interface PasswordChange {
  current_password: string;
  new_password: string;
}

// ---------- Projects ----------
export interface ProjectCreate {
  name: string;
  description?: string | null;
  color?: string;
}

export interface ProjectUpdate {
  name?: string;
  description?: string | null;
  color?: string;
  is_archived?: boolean;
}

export interface ProjectResponse {
  id: number;
  owner_id: number;
  name: string;
  description: string | null;
  color: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string | null;
  member_count: number;
  assignment_count: number;
  open_assignment_count: number;
}

export interface ProjectMemberResponse {
  id: number;
  user: UserSummary;
  role: ProjectRole;
  joined_at: string;
}

export interface ProjectDetail extends ProjectResponse {
  members: ProjectMemberResponse[];
}

export interface AddMemberRequest {
  email: string;
}

// ---------- Assignments ----------
export interface AssignmentCreate {
  project_id: number;
  title: string;
  description?: string | null;
  priority?: AssignmentPriority;
  status?: AssignmentStatus;
  due_date?: string | null; // YYYY-MM-DD
  assignee_id?: number | null;
}

export interface AssignmentUpdate {
  title?: string;
  description?: string | null;
  priority?: AssignmentPriority;
  due_date?: string | null;
}

export interface StatusUpdate {
  status: AssignmentStatus;
}

export interface AssigneeUpdate {
  assignee_id: number | null;
}

export interface AssignmentResponse {
  id: number;
  project_id: number;
  project_name: string;
  title: string;
  description: string | null;
  status: AssignmentStatus;
  priority: AssignmentPriority;
  due_date: string | null; // YYYY-MM-DD
  completed_at: string | null;
  /** null when the creator's account was deleted. */
  created_by: UserSummary | null;
  assignee: UserSummary | null;
  is_overdue: boolean;
  comment_count: number;
  created_at: string;
  updated_at: string | null;
}

export interface AssignmentPage {
  items: AssignmentResponse[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface AssignmentFilters {
  project_id?: number;
  status?: AssignmentStatus;
  priority?: AssignmentPriority;
  assignee_id?: number;
  mine?: boolean;
  overdue?: boolean;
  q?: string;
  sort?: AssignmentSort;
  page?: number;
  size?: number;
}

// ---------- Comments ----------
export interface CommentCreate {
  body: string;
}

export interface CommentResponse {
  id: number;
  assignment_id: number;
  /** null when the author's account was deleted. */
  author: UserSummary | null;
  body: string;
  created_at: string;
  updated_at: string | null;
}

// ---------- Dashboard ----------
export interface StatusCounts {
  todo: number;
  in_progress: number;
  in_review: number;
  done: number;
}

export interface RecentComment {
  id: number;
  body: string;
  created_at: string;
  /** null when the author's account was deleted. */
  author: UserSummary | null;
  assignment_id: number;
  assignment_title: string;
}

export interface DashboardSummary {
  total: number;
  by_status: StatusCounts;
  overdue_count: number;
  assigned_to_me_count: number;
  due_this_week: AssignmentResponse[];
  overdue: AssignmentResponse[];
  recent_comments: RecentComment[];
}

// ---------- Errors ----------
export interface ApiErrorBody {
  detail: string | { msg: string; loc?: (string | number)[]; type?: string }[];
  code?: string;
}

// ---------- AI ----------
export interface AIStatus {
  enabled: boolean;
  daily_limit: number;
  used_today: number;
  remaining_today: number;
}

export interface PlanRequest {
  goal: string;
  deadline?: string | null;
  max_items?: number;
}

export interface PlanItem {
  title: string;
  description: string | null;
  priority: AssignmentPriority;
  due_date: string | null;
  assignee_id: number | null;
}

export interface PlanDraftItem extends PlanItem {
  rationale: string | null;
}

export interface PlanDraft {
  items: PlanDraftItem[];
  notes: string | null;
}

export interface ProjectReport {
  headline: string;
  completed: string[];
  in_progress: string[];
  at_risk: string[];
  next_steps: string[];
  workload: string[];
  generated_at: string;
}
