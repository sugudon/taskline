# PRP: Taskline

> Implementation blueprint for parallel agent execution

---

## METADATA

| Field | Value |
|-------|-------|
| **Product** | Taskline |
| **Type** | SaaS |
| **Version** | 1.0 |
| **Created** | 2026-10-10 |
| **Complexity** | Medium |

---

## PRODUCT OVERVIEW

**Description:** A web-based platform to manage, organize, assign, and track assignments in one place. Users group assignments into projects, assign them to project members, move them through a status workflow, and see progress at a glance on a dashboard.

**Value Proposition:** Replaces scattered spreadsheets, chat threads, and email with a single source of truth for who owns what and when it is due. Clear status and overdue visibility means fewer missed deadlines and less time spent chasing updates.

**MVP Scope:**
- [ ] User registration/login (email + password and Google OAuth)
- [ ] Projects to organize assignments, with members invited by email
- [ ] Assignment CRUD with title, description, due date, priority, and status
- [ ] Assign/reassign assignments to project members
- [ ] Status workflow tracking: `todo → in_progress → in_review → done`
- [ ] Comments on assignments for progress updates
- [ ] Dashboard with counts by status, overdue, and due-this-week lists
- [ ] Filter/sort assignment list (project, status, priority, assignee, due date)

**Out of scope for v1:** payments, file attachments, email notifications, real-time updates, recurring assignments.

---

## ASSUMPTIONS

INITIAL.md left Modules 2–3, Type, UI, and Payments as placeholders. This PRP resolves them as follows:

| Item | Decision |
|------|----------|
| Product name | "Taskline" (renamed from "Taskline" on 2026-10-10) |
| Type | SaaS |
| UI | Chakra UI + Framer Motion |
| Payments | None |
| Module 2 | Projects (organize + membership) |
| Module 3 | Assignments (assign + track + comments) |
| API prefix | `/api/v1` (matches `skills/FRONTEND.md` API client) |

---

## TECH STACK

| Layer | Technology | Skill Reference |
|-------|------------|-----------------|
| Backend | FastAPI + Python 3.11+ | skills/BACKEND.md |
| Frontend | React + TypeScript + Vite | skills/FRONTEND.md |
| Database | PostgreSQL + SQLAlchemy + Alembic | skills/DATABASE.md |
| Auth | JWT (access + refresh) + bcrypt + Google OAuth | skills/BACKEND.md |
| UI | Chakra UI + Framer Motion | skills/FRONTEND.md |
| Data fetching | Axios + TanStack Query | skills/FRONTEND.md |
| Testing | pytest + pytest-cov + Vitest/RTL | skills/TESTING.md |
| Deployment | Docker + docker-compose + GitHub Actions | skills/DEPLOYMENT.md |

---

## DATABASE MODELS

### User
- id, email (unique, indexed), hashed_password (nullable for OAuth users), full_name, avatar_url, is_active, is_verified, oauth_provider, google_id (unique, nullable), created_at, updated_at
- Relationships: owned_projects, project_memberships, created_assignments, assigned_assignments, comments, refresh_tokens

### RefreshToken
- id, user_id (FK → users, cascade), token_hash (unique), expires_at, revoked (bool), created_at
- Stored hashed; rotated on every `/auth/refresh`; revoked on logout

### Project
- id, owner_id (FK → users), name, description, color (hex string), is_archived, created_at, updated_at
- Relationships: owner, members, assignments (cascade delete)

### ProjectMember
- id, project_id (FK → projects, cascade), user_id (FK → users, cascade), role (enum: `owner`, `member`), joined_at
- Unique constraint: (project_id, user_id)
- Owner row is created automatically when a project is created

### Assignment
- id, project_id (FK → projects, cascade), created_by_id (FK → users), assignee_id (FK → users, nullable, SET NULL), title, description, status (enum: `todo`, `in_progress`, `in_review`, `done`), priority (enum: `low`, `medium`, `high`, `urgent`), due_date (nullable), completed_at (nullable, set when status → `done`), created_at, updated_at
- Indexes: (project_id, status), (assignee_id), (due_date)
- Rule: assignee must be a member of the project

### Comment
- id, assignment_id (FK → assignments, cascade), author_id (FK → users), body (text), created_at, updated_at

**Access rules (enforced in services):**
- A user can see a project and its assignments only if they are a member.
- Only the project owner can edit/delete the project or manage members.
- Any member can create assignments and change status; only the creator, assignee, or project owner can edit/delete an assignment.
- Only a comment's author can delete it.

---

## MODULES

### Module 1: Authentication
**Agents:** DATABASE-AGENT + BACKEND-AGENT + FRONTEND-AGENT

**Backend Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/auth/register | Create account (bcrypt hash), return tokens |
| POST | /api/v1/auth/login | Email/password login, return access + refresh tokens |
| POST | /api/v1/auth/refresh | Rotate refresh token, return new pair |
| POST | /api/v1/auth/logout | Revoke refresh token |
| GET | /api/v1/auth/me | Current user |
| PUT | /api/v1/auth/me | Update profile (full_name, avatar_url) |
| GET | /api/v1/auth/google | Redirect to Google consent screen |
| GET | /api/v1/auth/google/callback | Exchange code, upsert user, redirect to frontend with tokens |

**Frontend Pages:**
| Route | Page | Components |
|-------|------|------------|
| /login | LoginPage | LoginForm, GoogleButton, GradientButton |
| /register | RegisterPage | RegisterForm, GoogleButton |
| /auth/callback | OAuthCallbackPage | (stores tokens, redirects to /dashboard) |
| /profile | ProfilePage | ProfileForm, AvatarUpload (URL field) |

**Shared:** `AuthContext`, `ProtectedRoute`, Axios interceptor with refresh-on-401.

---

### Module 2: Projects
**Agents:** BACKEND-AGENT + FRONTEND-AGENT

**Description:** Organize assignments into projects and control who can see and be assigned work.

**Backend Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/projects | List projects the user is a member of (with assignment counts) |
| POST | /api/v1/projects | Create project (creator becomes owner member) |
| GET | /api/v1/projects/{id} | Get project with members |
| PUT | /api/v1/projects/{id} | Update project (owner only) |
| DELETE | /api/v1/projects/{id} | Delete project (owner only) |
| GET | /api/v1/projects/{id}/members | List members |
| POST | /api/v1/projects/{id}/members | Add member by email (owner only; user must exist) |
| DELETE | /api/v1/projects/{id}/members/{user_id} | Remove member (owner only; unassigns their open assignments) |

**Frontend Pages:**
| Route | Page | Components |
|-------|------|------------|
| /projects | ProjectListPage | ProjectCard, EmptyState, GradientButton |
| /projects/new | ProjectCreatePage | ProjectForm (name, description, color) |
| /projects/:id | ProjectDetailPage | ProjectHeader, MemberList, AddMemberForm, AssignmentBoard (status columns) |
| /projects/:id/edit | ProjectEditPage | ProjectForm |

---

### Module 3: Assignments
**Agents:** BACKEND-AGENT + FRONTEND-AGENT

**Description:** Create, assign, and track assignments through a status workflow, with comments for progress updates.

**Backend Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/assignments | List visible assignments; query params: `project_id`, `status`, `priority`, `assignee_id`, `mine`, `overdue`, `sort`, `page`, `size` |
| POST | /api/v1/assignments | Create assignment in a project |
| GET | /api/v1/assignments/{id} | Get assignment with assignee + creator |
| PUT | /api/v1/assignments/{id} | Update fields |
| DELETE | /api/v1/assignments/{id} | Delete |
| PATCH | /api/v1/assignments/{id}/status | Change status (sets/clears `completed_at`) |
| PATCH | /api/v1/assignments/{id}/assignee | Assign/unassign (validates project membership) |
| GET | /api/v1/assignments/{id}/comments | List comments |
| POST | /api/v1/assignments/{id}/comments | Add comment |
| DELETE | /api/v1/assignments/{id}/comments/{comment_id} | Delete own comment |

**Frontend Pages:**
| Route | Page | Components |
|-------|------|------------|
| /assignments | AssignmentListPage | AssignmentTable, FilterBar, StatusBadge, PriorityBadge, Pagination |
| /assignments/new | AssignmentCreatePage | AssignmentForm (project select, assignee select, due date, priority) |
| /assignments/:id | AssignmentDetailPage | AssignmentHeader, StatusSelect, AssigneeSelect, CommentThread, CommentForm |
| /assignments/:id/edit | AssignmentEditPage | AssignmentForm |

---

### Module 4: Dashboard
**Agents:** BACKEND-AGENT + FRONTEND-AGENT

**Backend Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/dashboard/summary | Counts by status, overdue count, assigned-to-me count, due-this-week list (top 10), recent activity (latest comments) |

**Frontend Pages:**
| Route | Page | Components |
|-------|------|------------|
| /dashboard | DashboardPage | StatCard, StatusBreakdown, DueSoonList, OverdueList, RecentActivity |
| /settings | SettingsPage | AccountSettings, ChangePasswordForm, DangerZone (delete account) |

**Supporting endpoints:** `GET /health` (unauthenticated, DB ping), `PUT /api/v1/auth/password` (change password, email users only).

---

## PHASE EXECUTION PLAN

**Phase 1: Foundation (4 agents in parallel)**
- DATABASE-AGENT: `database.py`, all 6 models, enums, initial Alembic migration
- BACKEND-AGENT: `main.py`, `config.py` (pydantic-settings), CORS, logging, error handlers, router skeletons, `/health`
- FRONTEND-AGENT: Vite + Chakra setup, router, `services/api.ts`, `AuthContext`, layout (`PageWrapper`, nav), base UI components, `types/` interfaces
- DEVOPS-AGENT: `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml` (db, backend, frontend), `.env.example`, GitHub Actions CI (lint, type-check, test, build)

**Validation Gate 1:** `pip install -r requirements.txt`, `alembic upgrade head`, `npm install`, `docker-compose config`

**Phase 2: Modules (backend + frontend parallel per module)**
- Auth Module: JWT + refresh rotation + Google OAuth endpoints ↔ Login/Register/Callback/Profile pages
- Projects Module: project + membership endpoints ↔ Project list/create/detail/edit pages
- Assignments Module: assignment + status + assignee + comment endpoints ↔ Assignment list/create/detail/edit pages
- Dashboard Module: summary endpoint + password change ↔ Dashboard/Settings pages

Contract rule: backend Pydantic schemas are the source of truth; frontend `types/` must match them by name.

**Validation Gate 2:** `ruff check backend/`, `mypy backend/app`, `npm run lint`, `npm run type-check`

**Phase 3: Quality (3 agents in parallel)**
- TEST-AGENT: pytest (auth flow, permission matrix for projects/assignments, status → `completed_at`, assignee membership validation, dashboard counts) + RTL tests (forms, protected routes, filter bar); 80%+ coverage
- REVIEW-AGENT: Security audit (authz on every resource, IDOR checks, token storage/rotation, OAuth state param, no secrets in code), N+1 query review, forbidden-pattern scan (`print`, `any`, `console.log`, inline styles)
- RESEARCH-AGENT: Validate against FastAPI/SQLAlchemy 2.x/Chakra best practices

**Final Validation:** Full test suite, docker build, health checks

---

## VALIDATION GATES

| Gate | Commands |
|------|----------|
| 1 | `alembic upgrade head`, `npm install`, `docker-compose config` |
| 2 | `ruff check backend/`, `mypy backend/app`, `npm run lint`, `npm run type-check` |
| 3 | `pytest --cov=app --cov-fail-under=80`, `npm test` |
| Final | `docker-compose build`, `docker-compose up -d`, `curl localhost:8000/health` |

---

## ACCEPTANCE CRITERIA

- [ ] Users can register and log in with email/password and with Google
- [ ] Access tokens refresh transparently; logout revokes the refresh token
- [ ] Users can CRUD projects and add/remove members by email
- [ ] Users can CRUD assignments within projects they belong to
- [ ] Assignments can only be assigned to project members
- [ ] Status changes are tracked; `done` sets `completed_at`
- [ ] Non-members get 404 on another project's projects/assignments (no data leak)
- [ ] Dashboard shows accurate status counts, overdue, and due-this-week
- [ ] Assignment list supports filtering, sorting, and pagination
- [ ] 80%+ backend test coverage; frontend tests pass
- [ ] No forbidden patterns (see CLAUDE.md)
- [ ] `docker-compose build` succeeds and `/health` returns 200

---

## ENVIRONMENT VARIABLES

```env
DATABASE_URL=postgresql://user:password@localhost:5432/taskline
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/v1/auth/google/callback
FRONTEND_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173
VITE_API_URL=http://localhost:8000
```

---

## NEXT STEP

Execute with parallel agents:
/execute-prp PRPs/taskline-prp.md
