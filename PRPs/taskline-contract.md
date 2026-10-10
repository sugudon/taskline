# Taskline — Shared Contract

> Source of truth for every agent. Backend Pydantic schemas and frontend `src/types/index.ts` MUST match these names and fields exactly.

## Global conventions

- Python 3.12 venv at `backend/.venv` (`python3.12 -m venv backend/.venv`). Run backend tools from `backend/` (imports are `from app...`).
- SQLAlchemy 2.x **sync** `Session`, typed declarative style (`DeclarativeBase`, `Mapped[...]`, `mapped_column`). `Base` and `get_db` live in `app/database.py`.
- Passwords: `bcrypt` package directly (not passlib). JWT: `PyJWT` (`import jwt`).
- All API routes under `/api/v1`. `GET /health` at root.
- Errors: `app/exceptions.py` → `AppException(message, code, status_code)`, subclasses `NotFoundError(resource)` 404, `ConflictError` 409, `ForbiddenError` 403, `UnauthorizedError` 401, `BadRequestError` 400. Handler returns `{"detail": message, "code": code}`.
- Non-members accessing a project/assignment get **404** (not 403). Members lacking permission get **403**.
- DB errors: `IntegrityError` → 409 `{"detail":"Conflicting data","code":"CONFLICT"}`; `OperationalError` → 503 `{"detail":..., "code":"SERVICE_UNAVAILABLE"}`.
- Rate limits (per client IP, `RATE_LIMIT_ENABLED` setting, default true): POST /auth/login 5/min, POST /auth/register 3/min, POST /auth/refresh 30/min, PUT /auth/password 5/min. Exceeded → 429 `{"detail": str, "code": "RATE_LIMITED"}` (+ `Retry-After`, CORS headers present).
- Archived projects are read-only: creating/updating assignments (incl. status/assignee), creating comments and adding members → 409 `{"detail":"Project is archived","code":"CONFLICT"}`. Project update (e.g. unarchive) and delete remain allowed for the owner.
- `SECRET_KEY` must be ≥ 32 chars and not a known placeholder (app refuses to start otherwise).
- Datetimes: timezone-aware, serialized ISO 8601. `due_date` is a `date` (YYYY-MM-DD).
- Logging via `logging`, never `print`. No hardcoded secrets.
- Frontend: React 18 + TS + Vite, **Chakra UI v2** (`@chakra-ui/react@^2.10`, `@emotion/react`, `@emotion/styled`, `framer-motion@^11`), `react-router@^7.18` (declarative mode), `@tanstack/react-query@^5`, `axios`. No `any`, no `console.log`, no `style={{}}` (use Chakra props). Animated components built with `motion(Box)` / `motion(Button)` + Chakra style props (not Tailwind classes).
- Frontend dev port 5173; Docker frontend (nginx) port 3000; backend 8000.

## Enums

```
AssignmentStatus = "todo" | "in_progress" | "in_review" | "done"
AssignmentPriority = "low" | "medium" | "high" | "urgent"
ProjectRole = "owner" | "member"
```

## Schemas (response / request)

```
UserResponse        { id, email, full_name: str|null, avatar_url: str|null, is_active, is_verified, oauth_provider: str|null, has_password: bool, created_at }
UserSummary         { id, email, full_name: str|null, avatar_url: str|null }

Token               { access_token, refresh_token, token_type: "bearer" }
RegisterRequest     { email, password (min 8), full_name?: str }
RefreshRequest      { refresh_token }
LogoutRequest       { refresh_token }
UserUpdate          { full_name?: str, avatar_url?: str|null (absolute http/https URL, ≤500; blank → null; else 422) }
PasswordChange      { current_password, new_password (min 8) }

ProjectCreate       { name (1-100), description?: str|null (≤10000), color?: "#RRGGBB" (default "#805AD5") }
ProjectUpdate       { name?, description? (≤10000), color?, is_archived?: bool }
ProjectResponse     { id, owner_id, name, description, color, is_archived, created_at, updated_at: datetime|null,
                      member_count: int, assignment_count: int, open_assignment_count: int }
ProjectDetail       = ProjectResponse + { members: ProjectMemberResponse[] }
ProjectMemberResponse { id, user: UserSummary, role: ProjectRole, joined_at }
AddMemberRequest    { email }

AssignmentCreate    { project_id, title (1-200), description?: str|null (≤10000), priority?: (default "medium"),
                      status?: (default "todo"), due_date?: date|null, assignee_id?: int|null }
AssignmentUpdate    { title?, description? (≤10000), priority?, due_date?, (status/assignee via their own endpoints) }
StatusUpdate        { status }
AssigneeUpdate      { assignee_id: int|null }
AssignmentResponse  { id, project_id, project_name, title, description, status, priority, due_date, completed_at,
                      created_by: UserSummary|null (null once the creator deleted their account),
                      assignee: UserSummary|null, is_overdue: bool, comment_count: int,
                      created_at, updated_at }
AssignmentPage      { items: AssignmentResponse[], total, page, size, pages }

CommentCreate       { body (1-5000) }
CommentResponse     { id, assignment_id, author: UserSummary|null (null = deleted account), body, created_at, updated_at }

DashboardSummary    { total: int, by_status: { todo, in_progress, in_review, done },
                      overdue_count, assigned_to_me_count (open work assigned to me),
                      my_assignments: AssignmentResponse[] (max 20, not done, assignee = me; dated first by due_date, then by priority),
                      due_this_week: AssignmentResponse[] (max 10, not done, ordered by due_date),
                      overdue: AssignmentResponse[] (max 10), recent_comments: RecentComment[] (max 10) }
RecentComment       { id, body, created_at, author: UserSummary|null, assignment_id, assignment_title }
```

`is_overdue` = due_date < today and status != done.

## Endpoints

### Auth (`routers/auth.py`, prefix `/auth`)
| Method | Path | Body | Response |
|---|---|---|---|
| POST | /auth/register | RegisterRequest (JSON) | 201 Token (409 if email exists) |
| POST | /auth/login | **form** `username`, `password` (OAuth2PasswordRequestForm) | Token (401 bad creds) |
| POST | /auth/refresh | RefreshRequest | Token (rotates; old one revoked; 401 if invalid/revoked/expired) |
| POST | /auth/logout | LogoutRequest | 204 |
| GET | /auth/me | – | UserResponse |
| PUT | /auth/me | UserUpdate | UserResponse |
| PUT | /auth/password | PasswordChange | 204 (400 if OAuth-only user or wrong current password) |
| DELETE | /auth/me | – | 204 (deletes account + owned solo projects; authored assignments/comments elsewhere are kept with `created_by`/`author` = null). 409 CONFLICT "Transfer or delete your shared projects before deleting your account" if the user owns a project that has other members |
| GET | /auth/google | query `nonce` (**required**, 16–128 chars, `^[A-Za-z0-9_-]+$`) | 307 redirect to Google; sets httponly cookies `oauth_state` and `oauth_nonce` (Max-Age 600, SameSite=Lax, Path=/). Missing/invalid nonce → 307 to `{FRONTEND_URL}/auth/callback#error=invalid_request`. Not configured → 503 |
| GET | /auth/google/callback | `code`, `state` query | 307 redirect to `{FRONTEND_URL}/auth/callback#access_token=..&refresh_token=..&nonce=..`, or `#error=<code>&nonce=..` (nonce included whenever a valid `oauth_nonce` cookie was present). Missing nonce cookie → `#error=invalid_state` (no nonce). Both cookies are cleared. The SPA must check the returned `nonce` equals the one it generated (sessionStorage) before using the tokens |

Error codes on the callback fragment: `invalid_request` (start only), `oauth_not_configured`, `access_denied`, `invalid_state`, `missing_code`, `token_exchange_failed`, `userinfo_failed`, `userinfo_incomplete`, `email_not_verified`, `account_disabled`, `account_conflict`.

Google linking: when Google signs into an existing account matched by email whose `is_verified` is false, that account's password is removed (`has_password` → false) and all its refresh tokens are revoked (pre-account-takeover defence). Verified accounts keep their password.

Refresh tokens are JWTs with a `jti`; the DB stores `sha256(token)` in `refresh_tokens.token_hash`. Issuing tokens purges that user's rows that expired, or were revoked, more than 1 day ago. Login with an unknown email (or an OAuth-only account) still runs a bcrypt check (constant time).

### Projects (`routers/projects.py`, prefix `/projects`)
| Method | Path | Body | Response |
|---|---|---|---|
| GET | /projects?include_archived=false | – | ProjectResponse[] |
| POST | /projects | ProjectCreate | 201 ProjectDetail |
| GET | /projects/{id} | – | ProjectDetail |
| PUT | /projects/{id} | ProjectUpdate | ProjectDetail (owner) |
| DELETE | /projects/{id} | – | 204 (owner) |
| GET | /projects/{id}/members | – | ProjectMemberResponse[] |
| POST | /projects/{id}/members | AddMemberRequest | 201 ProjectMemberResponse (owner; 404 if no such user; 409 if already member) |
| DELETE | /projects/{id}/members/{user_id} | – | 204 (owner; cannot remove owner → 400; unassigns their non-done assignments in project) |

### Assignments (`routers/assignments.py`, prefix `/assignments`)
| Method | Path | Body | Response |
|---|---|---|---|
| GET | /assignments | query: project_id, status, priority, assignee_id, mine (bool), overdue (bool), q (title search), sort (`due_date`,`-due_date`,`created_at`,`-created_at`,`priority`,`-priority`; default `-created_at`), page=1, size=20 (max 100) | AssignmentPage |
| POST | /assignments | AssignmentCreate | 201 AssignmentResponse |
| GET | /assignments/{id} | – | AssignmentResponse |
| PUT | /assignments/{id} | AssignmentUpdate | AssignmentResponse (creator/assignee/project owner) |
| DELETE | /assignments/{id} | – | 204 (creator/project owner) |
| PATCH | /assignments/{id}/status | StatusUpdate | AssignmentResponse (any member; done sets completed_at, leaving done clears it) |
| PATCH | /assignments/{id}/assignee | AssigneeUpdate | AssignmentResponse (project owner a.k.a. Scrum master, or the task's creator → else 403; assignee must be member → 400) |
| GET | /assignments/{id}/comments | – | CommentResponse[] (oldest first) |
| POST | /assignments/{id}/comments | CommentCreate | 201 CommentResponse |
| DELETE | /assignments/{id}/comments/{comment_id} | – | 204 (author only) |

### Dashboard (`routers/dashboard.py`, prefix `/dashboard`)
| GET | /dashboard/summary | – | DashboardSummary (scoped to projects the user belongs to) |

## File ownership (to avoid parallel edit conflicts)

Phase 1 creates every shared file; Phase 2 module agents edit **only their own files**.

Backend shared (Phase 1): `main.py` (already includes all 4 routers), `config.py`, `database.py`, `exceptions.py`, `dependencies.py` (`get_current_user` fully implemented in Phase 1 using `app/auth/security.py`), `app/auth/security.py` (hash/verify password, create/decode tokens), all models.
Backend per module: `schemas/<module>.py`, `services/<module>_service.py`, `routers/<module>.py` (Phase 1 leaves a stub `router = APIRouter(prefix=..., tags=[...])`). `schemas/user.py` (UserResponse, UserSummary) is created in Phase 1. `services/access.py` (`get_project_for_member(db, project_id, user) -> Project` raising 404, `require_owner(project, user)` raising 403, `member_project_ids(db, user) -> select`) is created in Phase 1 and shared.

Frontend shared (Phase 1): `App.tsx` (all routes, pointing at page files that exist as placeholders), `main.tsx`, `theme.ts`, `services/api.ts`, `types/index.ts` (all interfaces above), `components/ui/*`, `components/layout/*` (PageWrapper, MeshBackground, AppLayout with nav), `context/AuthContext.tsx` + `components/auth/ProtectedRoute.tsx` (functional in Phase 1).
Frontend per module: its pages, `components/<module>/*`, `hooks/use<Module>.ts`, `services/<module>Service.ts`.

Page files (Phase 1 placeholders, Phase 2 implements):
`pages/LoginPage.tsx, RegisterPage.tsx, OAuthCallbackPage.tsx, ProfilePage.tsx` (auth) ·
`pages/projects/ProjectListPage.tsx, ProjectCreatePage.tsx, ProjectDetailPage.tsx, ProjectEditPage.tsx` ·
`pages/assignments/AssignmentListPage.tsx, AssignmentCreatePage.tsx, AssignmentDetailPage.tsx, AssignmentEditPage.tsx` ·
`pages/DashboardPage.tsx, SettingsPage.tsx`. `/` redirects to `/dashboard`.

### AI (`routers/ai.py`, prefix `/ai`) — OpenAI, disabled when `OPENAI_API_KEY` is empty
| Method | Path | Body | Response |
|---|---|---|---|
| GET | /ai/status | – | AIStatus `{ enabled, daily_limit, used_today, remaining_today }` |
| POST | /ai/projects/{id}/plan | PlanRequest `{ goal (3–2000), deadline?: date, max_items: 3–20 (default 8) }` | PlanDraft `{ items: PlanDraftItem[], notes }` — nothing saved (member; archived → 409) |
| POST | /ai/projects/{id}/plan/apply | `{ items: PlanItem[] (1–30) }` | 201 AssignmentResponse[] — created in one transaction (assignee must be member → 400) |
| POST | /ai/projects/{id}/report | – | ProjectReport `{ headline, completed[], in_progress[], at_risk[], next_steps[], workload[], generated_at }` |

`PlanItem { title, description, priority, due_date, assignee_id }`; `PlanDraftItem = PlanItem + { rationale }`.
Errors: AI disabled → 503 `AI_DISABLED`; OpenAI failure/refusal → 502 `AI_UNAVAILABLE`; per-user daily limit
(`AI_DAILY_LIMIT`, counted in `ai_usage`, reset at UTC midnight) → 429 `AI_QUOTA_EXCEEDED`.
Model output is validated: due dates clamped to [today, deadline], unknown assignees dropped, lists capped.
Project data is sent as delimited untrusted data; member emails are never sent.
