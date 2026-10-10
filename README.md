# Taskline

> Assign, track and deliver team work in one place, with AI that drafts the plan for you.

**Live:** https://taskline.sugunajayaram.tech

Taskline is a web app for teams to organize work into projects, assign it to people,
and track it from *To do* to *Done*. A Scrum master runs each project; team members
see and work on what's theirs. Built-in AI turns a goal into a set of assignments and
writes status reports on demand.

---

## Features

- **Projects:** group work by project, invite teammates by email, archive finished projects (read-only)
- **Assignments:** title, description, priority (low → urgent), due date, assignee and
  a status workflow `todo → in_progress → in_review → done`
- **Personal dashboard:** *My assignments*, status breakdown, due this week, overdue,
  recent activity; refreshes automatically when work is (re)assigned to you
- **Project board:** status columns per project, with filters, search, sorting and pagination on the assignments list
- **Comments:** discussion on every assignment
- **AI (OpenAI):**
  - **Plan with AI:** describe a goal (plus an optional deadline) and get a draft list of
    assignments with priorities, due dates and suggested assignees; review, edit and add them in one click
  - **AI status report:** a summary of completed work, risks, next steps and workload
- **Sign-in:** email + password, or Google

## Roles & permissions

| Action | Scrum master (project owner) | Task creator | Current assignee | Other team members |
|---|:-:|:-:|:-:|:-:|
| See the assignment | ✅ all in their projects | ✅ | ✅ | ❌ |
| Create assignments (for anyone in the project) | ✅ | ✅ | ✅ | ✅ |
| Reassign to someone else | ✅ | ✅ | ✅ | ❌ |
| Change status, comment | ✅ | ✅ | ✅ | ❌ |
| Edit details | ✅ | ✅ | ✅ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ |
| Edit/archive project, manage members | ✅ | ❌ | ❌ | ❌ |

Team members only ever see assignments **assigned to them or created by them**. Everything
else returns *not found*, including in lists, counts, the dashboard and AI reports.
Archived projects are read-only.

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, Python 3.12, SQLAlchemy 2, Alembic, Pydantic 2 |
| Database | PostgreSQL 16 |
| Auth | JWT access + rotating refresh tokens, bcrypt, Google OAuth |
| AI | OpenAI API (structured outputs), default model `gpt-5.4-mini` |
| Frontend | React 18, TypeScript, Vite, Chakra UI, Framer Motion, TanStack Query, React Router 7 |
| Testing | pytest (≥80% coverage gate), Vitest + Testing Library (≥75% gate) |
| Infra | Docker Compose, nginx, Traefik or Caddy (HTTPS), GitHub Actions CI |

---

## Quick start (Docker)

Requires Docker Desktop.

```bash
git clone https://github.com/sugudon/taskline.git
cd taskline
make env      # creates .env with a random SECRET_KEY and database password
make dev      # db + backend (hot reload) + frontend (hot reload)
```

| URL | What |
|---|---|
| http://localhost:5173 | App (dev server) |
| http://localhost:8000/docs | API docs (Swagger) |

`make up` runs the production-like stack instead, with the app at http://localhost:3000.
Stop everything with `make down`; `make clean` also deletes the database volume.

### Optional features

Add these to `.env`, then restart the backend:

```env
# AI features (hidden in the UI when the key is empty)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.4-mini
AI_DAILY_LIMIT=30            # AI requests per user per day

# Google sign-in
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
```

For Google sign-in, add the redirect URI to your OAuth client (type *Web application*) in
Google Cloud Console → Credentials:

- Local: `http://localhost:8000/api/v1/auth/google/callback`
- Production: `https://<your-domain>/api/v1/auth/google/callback`

---

## Development without Docker

```bash
# Backend (needs a running PostgreSQL; set DATABASE_URL in .env)
cd backend
python3.12 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload

# Frontend
cd frontend
npm ci
npm run dev
```

## Tests & quality checks

```bash
make test     # backend pytest + frontend Vitest, with coverage
make lint     # ruff, mypy, eslint, tsc
make audit    # pip-audit + npm audit on runtime dependencies
```

Backend tests run on in-memory SQLite by default; set `TEST_DATABASE_URL` to run them
against PostgreSQL, as CI does. OpenAI calls are always mocked in tests.

CI (`.github/workflows/ci.yml`) runs lint, type checks, tests on PostgreSQL,
dependency audits and a Docker build on every push.

---

## Deployment

Taskline ships as one Docker Compose stack (`docker-compose.prod.yml`), with the app and
API on a single domain: `/` is the app and `/api/*` is the API.

```bash
deploy/deploy.sh root@<server-ip>
```

The script:

1. Installs Docker on the server if needed
2. Uploads the code to `/docker/taskline`; local `.env` files are not sent
3. On first run, creates `.env.production` with fresh random secrets (template: `deploy/.env.production.example`)
4. Builds and starts the stack; database migrations run automatically
5. Waits until `https://<DOMAIN>/health` responds

Re-run it to deploy updates; the database and secrets are kept.

**HTTPS:** by default the stack joins an existing **Traefik** on the server through Docker
labels (entrypoint `websecure`, cert resolver `letsencrypt`) and publishes no ports. On a
server without Traefik, use the bundled **Caddy** instead:

```bash
COMPOSE_PROFILES=caddy deploy/deploy.sh root@<server-ip> you@example.com
```

Point a DNS A record for your domain at the server before the first deploy. Set `DOMAIN`
in `.env.production` (default `taskline.sugunajayaram.tech`), and add `OPENAI_API_KEY` and the
Google credentials there to enable those features.

> Anyone can register on a public deployment and each account gets its own daily AI
> allowance, so set a monthly spending limit in your OpenAI account.

---

## Configuration reference

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | – | PostgreSQL connection string |
| `SECRET_KEY` | – | JWT signing key, **≥32 random characters** (the app refuses placeholders) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token lifetime |
| `RATE_LIMIT_ENABLED` | `true` | Rate limits on login, register, refresh and password change |
| `FRONTEND_URL` / `CORS_ORIGINS` | localhost | Where OAuth returns to and which origins may call the API |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | empty | Google sign-in (disabled when empty) |
| `OPENAI_API_KEY` | empty | Enables AI features |
| `OPENAI_MODEL` | `gpt-5.4-mini` | Model for AI features |
| `AI_DAILY_LIMIT` | `30` | AI requests per user per day (UTC) |
| `VITE_API_URL` | `http://localhost:8000` | API origin baked into the frontend build (empty = same origin) |

---

## Project structure

```
backend/
  app/
    routers/      # auth, projects, assignments, dashboard, ai
    services/     # business logic and access rules (services/access.py)
    models/       # SQLAlchemy models
    schemas/      # Pydantic request/response models
  alembic/        # database migrations
  tests/
frontend/
  src/
    pages/        # route pages
    components/   # UI, layout, feature components (incl. components/ai)
    hooks/        # TanStack Query hooks
    services/     # API clients
deploy/           # Caddyfile, deploy script, production env template
PRPs/             # product blueprint and API contract
```

The API contract (endpoints, schemas, permission rules) is documented in
[`PRPs/taskline-contract.md`](PRPs/taskline-contract.md).

---

## How it was built

Taskline was generated from a product definition (`INITIAL.md`) using a PRP
(product requirements prompt) workflow with Claude Code: `/generate-prp` produced the
blueprint in `PRPs/`, and `/execute-prp` built it with parallel agents (database, backend,
frontend, DevOps, then testing, security review and research). The agent and skill definitions
are in `agents/` and `skills/`.
