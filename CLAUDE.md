# CLAUDE.md

## CRITICAL — Read First

**NEVER create git commits or amend existing commits unless the user explicitly says "commit".** Completing an edit, fixing a bug, or passing tests does NOT mean you should commit. Wait for the user to ask.

## Workflow Rules

- **Always run backend BDD tests** after any backend change. Do not consider work complete until they pass.
- **Always run E2E tests** after any frontend change. Do not consider work complete until they pass.
- **Mobile matters** — iOS Safari/Chrome and Android Chrome equally. Use `text-base sm:text-sm` on inputs to prevent auto-zoom, test touch interactions, respect mobile viewports.
- **Update all relevant docs** (CLAUDE.md + README.md) together, not just one.

## Commands

```bash
# Backend BDD tests (from repo root)
docker compose -f docker-compose.yml -f docker-compose.test.yml run --build --rm backend-test

# E2E tests (clean DB, production builds, port 8099)
COMMIT_SHA=$(git rev-parse HEAD) docker compose -f docker-compose.yml -f docker-compose.test.yml up --build -d --wait -V
npm --prefix e2e install && BASE_URL=http://localhost:8099 npm --prefix e2e test
docker compose -f docker-compose.yml -f docker-compose.test.yml down

# Dev stack (port 8090, hot reload)
docker compose up --build -d    # --build required after Prisma schema changes
docker compose down

# Frontend type-check + build
npm run build    # from: frontend/

# Prisma migrations (from: backend/)
npx prisma migrate dev
```

## Architecture

### Request flow

```
Browser → nginx → /api/* → backend (Fastify :3001)
                → /*     → frontend (Vite :5173 dev, static files prod)
```

Dev: nginx proxies both (`nginx/nginx.dev.conf`). Prod: Caddy terminates TLS and reverse-proxies to frontend container with baked-in nginx (`frontend/nginx.conf`).

### Backend (`backend/src/`)

`buildApp()` in `server.ts` wires: `@fastify/cookie` → `prismaPlugin` (shared `PrismaClient`) → `registerRoutes` (all routes under `/api`).

Auth: `middleware/requireAuth.ts` verifies JWT from `token` HttpOnly cookie, sets `request.user`. Admin: `middleware/requireAdmin.ts` checks `request.user.role === 'ADMIN'`.

Routes map 1:1 to resources: `auth`, `taskLists`, `tasks`, `shares`, `templates`, `template-shares`, `admin`. Each delegates to a matching `services/` file.

### Database

Schema: `backend/src/prisma/schema.prisma`. Migrations auto-run on startup (`prisma migrate deploy`).

Data model: `User` (role: USER/ADMIN) → `TaskList` → `Task` (ordered by `order`) + `TaskListShare` (READ/WRITE). `TaskTemplate` → `TemplateTask` + `TemplateShare` (same model). Admin promotion driven by `ADMIN_EMAILS` env var on register/login.

### Testing

Two independent BDD layers:
- **Backend** — `@cucumber/cucumber` + `tsx/cjs`. Features: `backend/features/*.feature`, steps: `backend/features/steps/`. Shared Fastify instance in `BeforeAll`, DB cleared per scenario.
- **E2E** — `playwright-bdd`. Features: `e2e/features/`, steps: `e2e/steps/`.

**Acceptance criteria** are `@ac`-tagged Gherkin scenarios in `e2e/features/` — the scenario name *is* the AC. Run `grep -A1 "@ac" e2e/features/**/*.feature` to list them.

### Docker Compose files

| File | Purpose |
|---|---|
| `docker-compose.yml` | Base: db, backend, frontend (no ports) |
| `docker-compose.override.yml` | Dev: hot reload, nginx on :8090 |
| `docker-compose.prod.yml` | Prod: Caddy with auto HTTPS (:80, :443) |
| `docker-compose.test.yml` | Test: BDD runner + E2E stack on :8099 |

### Environment variables

Required: `DATABASE_URL`, `JWT_SECRET`, `COOKIE_SECURE` (`false` dev/test, `true` prod), `DOMAIN` (prod only). Optional: `ADMIN_EMAILS` (comma-separated). See `.env.example`.

### Network / firewall

Host-level firewall restricts outbound access. Docker containers route through it. Ensure needed domains (e.g. `deb.debian.org`) are allowed.

### Deployment

Production: Azure VM (`Standard_B1s`). Push to `main` triggers 3-job GitHub Actions pipeline: (1) test — backend BDD + E2E in parallel, (2) build — images built in parallel via matrix, pushed to GHCR (skipped if no deploy-worthy changes), (3) deploy — SSH pull + restart. Secrets: `VM_HOST`, `VM_USER`, `VM_SSH_KEY`.
