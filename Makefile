.PHONY: help env dev up down logs build test test-backend test-frontend lint lint-backend lint-frontend audit migrate clean

COMPOSE     := docker compose
COMPOSE_DEV := docker compose -f docker-compose.dev.yml

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-15s %s\n", $$1, $$2}'

env: ## Create .env from .env.example (with random SECRET_KEY / POSTGRES_PASSWORD) if missing
	@if [ ! -f .env ]; then \
		secret=$$(openssl rand -hex 32); pgpass=$$(openssl rand -hex 16); \
		awk -v s="$$secret" -v p="$$pgpass" '\
			/^SECRET_KEY=/ { print "SECRET_KEY=" s; next } \
			/^POSTGRES_PASSWORD=/ { print "POSTGRES_PASSWORD=" p; next } \
			/^DATABASE_URL=/ { print "DATABASE_URL=postgresql://postgres:" p "@localhost:5432/taskline"; next } \
			{ print }' .env.example > .env; \
		echo "Created .env with generated SECRET_KEY and POSTGRES_PASSWORD"; \
	fi

dev: env ## Start dev stack with hot reload (db, backend :8000, frontend :5173)
	$(COMPOSE_DEV) up --build

up: env ## Start production-like stack in background (frontend :3000, backend :8000)
	$(COMPOSE) up --build -d

down: ## Stop all stacks
	$(COMPOSE) down
	$(COMPOSE_DEV) down

logs: ## Tail logs of the production-like stack
	$(COMPOSE) logs -f

build: env ## Build Docker images
	$(COMPOSE) build

test: test-backend test-frontend ## Run all tests

test-backend: ## Run backend tests with coverage
	cd backend && pytest --cov=app --cov-fail-under=80

test-frontend: ## Run frontend tests with coverage
	cd frontend && npm run test:coverage

lint: lint-backend lint-frontend ## Run all linters and type checks

lint-backend:
	cd backend && ruff check . && mypy app

lint-frontend:
	cd frontend && npm run lint && npm run type-check

audit: ## Audit runtime dependencies (backend + frontend)
	cd backend && pip-audit -r requirements.txt
	cd frontend && npm audit --omit=dev --audit-level=high

migrate: ## Apply migrations (inside running backend container)
	$(COMPOSE) exec backend alembic upgrade head

clean: ## Stop stacks and remove volumes
	$(COMPOSE) down -v
	$(COMPOSE_DEV) down -v
