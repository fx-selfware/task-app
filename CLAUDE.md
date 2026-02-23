# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow

Do not create git commits unless explicitly asked to do so.

When updating documentation, apply changes to all relevant docs in the repo (e.g. both CLAUDE.md and README.md), not just one file.

## Commands

### Backend

```bash
# Run BDD tests (requires both compose files; run from repo root)
docker compose -f docker-compose.yml -f docker-compose.test.yml run --rm backend-test

# Dev server
npx tsx watch src/index.ts   # from: backend/

# Prisma migrations (dev)
npx prisma migrate dev       # from: backend/
```

### Frontend

```bash
npm run build    # TypeScript check + Vite build (from: frontend/)
```

### E2E

```bash
# Clean-DB E2E run (production builds, port 8099):
docker compose -f docker-compose.yml -f docker-compose.test.yml up --build -d --wait -V
npm --prefix e2e install && BASE_URL=http://localhost:8099 npm --prefix e2e test
docker compose -f docker-compose.yml -f docker-compose.test.yml down

# Interactive mode against the dev stack (port 8090):
npm --prefix e2e install && npm --prefix e2e run test:ui

# View HTML test report (after a test run):
npx --prefix e2e playwright show-report e2e/playwright-report
```

### Full stack

```bash
docker compose up --build -d      # dev (port 8090, hot reload)
# --build is required after any Prisma schema change: node_modules (including
# the generated Prisma client) is baked into the image, not bind-mounted.
docker compose down

docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d   # prod (HTTPS via Caddy)
# Requires DOMAIN in .env (e.g. task-app-fx.westus2.cloudapp.azure.com)
```

## Architecture

### Request flow

```
Browser → nginx → /api/* → backend (Fastify :3001)
                → /*     → frontend (Vite :5173 in dev, static files in prod)
```

In dev, a separate nginx container (`nginx/nginx.dev.conf`) proxies both. In prod, Caddy terminates TLS (auto Let's Encrypt) and reverse-proxies to the frontend container, which has nginx baked in (`frontend/nginx.conf`).

### Backend (`backend/src/`)

`buildApp()` in `server.ts` wires three Fastify plugins in order:
1. `@fastify/cookie` — parses the `token` cookie
2. `prismaPlugin` — attaches `app.prisma` (a single shared `PrismaClient`)
3. `registerRoutes` — mounts all route modules under the `/api` prefix

Auth is enforced via `middleware/requireAuth.ts`, a Fastify preHandler that verifies a JWT from the `token` HttpOnly cookie and sets `request.user`. Every protected route passes it as `preHandler: requireAuth`.

Route files map 1:1 to domain resources: `auth`, `taskLists`, `tasks`, `shares`, `templates`. Each delegates business logic to a matching file in `services/`.

### Database

Prisma schema lives at `backend/src/prisma/schema.prisma`. Migrations run automatically on startup via `prisma migrate deploy` (see `backend/src/index.ts` or the Docker `command:`).

The data model: `User` owns `TaskList`s; `TaskList` has `Task`s (ordered by `order` field) and `TaskListShare`s (READ/WRITE permission per user). `TaskTemplate` / `TemplateTask` are a separate template system owned per user.

### Testing

Two BDD layers together achieve near-complete coverage. The layers are independent — backend tests hit the API directly; E2E tests drive a real browser.

**Backend BDD** — `@cucumber/cucumber` with `tsx/cjs` loader. Scenarios live in `backend/features/*.feature`; step definitions in `backend/features/steps/`. A single shared Fastify app instance is created in `BeforeAll` and reused across scenarios; each scenario clears the DB in `Before`.

**E2E BDD** — `playwright-bdd`. Feature files in `e2e/features/`; step definitions in `e2e/steps/`. Config uses `defineBddConfig()` from `playwright-bdd` to generate the test directory.

#### Acceptance criteria

The ACs live as `@ac`-tagged Gherkin scenarios in `e2e/features/`. There is no separate AC document — the scenario name *is* the AC statement.

```bash
# List all ACs
grep -A1 "@ac" e2e/features/**/*.feature

# Run only AC tests
BASE_URL=http://localhost:8099 npm --prefix e2e run test:ac
```

**Maintaining ACs:**
- **Add** — write a new scenario with `@ac` and a name that is the AC statement
- **Remove** — delete the `@ac` tag; the scenario stays as non-AC coverage, or delete it entirely
- **Change** — update the scenario name (the contract) and steps (the proof) together
- Scenarios without `@ac` are extra coverage (edge cases, error paths) not stated as user-facing ACs

### Docker Compose files

| File | Purpose |
|---|---|
| `docker-compose.yml` | Base: db, backend, frontend (no ports exposed) |
| `docker-compose.override.yml` | Dev: hot reload, nginx on :8090 |
| `docker-compose.prod.yml` | Prod: Caddy reverse proxy with auto HTTPS (:80, :443) |
| `docker-compose.test.yml` | Test: backend BDD runner + E2E stack on :8099 |

### Environment variables

Required at runtime: `DATABASE_URL`, `JWT_SECRET`, `COOKIE_SECURE` (`false` in dev/test, `true` in prod), `DOMAIN` (prod only — FQDN for Caddy's TLS certificate). See `.env.example`.

### Deployment

Production runs on a single Azure VM (`Standard_B1s`) at `task-app-fx.westus2.cloudapp.azure.com`. Pushing to `main` triggers GitHub Actions: backend BDD + E2E tests, then SSH deploy to the VM. GitHub secrets required: `VM_HOST`, `VM_USER`, `VM_SSH_KEY`.
