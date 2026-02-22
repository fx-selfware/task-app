# Acceptance Criteria

## Auth (8 ACs)
- [x] AC-A1: `POST /api/auth/register` with email/password/name → 201, httpOnly `token` cookie set, returns user object
- [x] AC-A2: `POST /api/auth/login` with valid credentials → 200, httpOnly `token` cookie set, returns user object
- [x] AC-A3: `POST /api/auth/login` with wrong password → 401
- [x] AC-A4: `GET /api/auth/me` with valid cookie → 200, returns user object
- [x] AC-A5: `GET /api/auth/me` without cookie → 401
- [x] AC-A6: `POST /api/auth/logout` → 200, cookie cleared
- [x] AC-A7: `token` cookie has `HttpOnly=true` and `SameSite=Strict`
- [x] AC-A8: Registering duplicate email → 409

## Task Lists (6 ACs)
- [x] AC-TL1: `POST /api/task-lists` → 201, creates list owned by current user
- [x] AC-TL2: `GET /api/task-lists` → 200, returns owned lists + lists shared with user
- [x] AC-TL3: `GET /api/task-lists/:id` (owner) → 200, returns list with tasks and shares
- [x] AC-TL4: `PATCH /api/task-lists/:id` (owner) → 200, renames list
- [x] AC-TL5: `DELETE /api/task-lists/:id` (owner) → 204, cascades tasks/shares
- [x] AC-TL6: Non-owner/non-shared `GET /api/task-lists/:id` → 404

## Tasks (5 ACs)
- [x] AC-T1: `POST /api/task-lists/:id/tasks` (write permission) → 201, appended with next order
- [x] AC-T2: `PATCH /api/task-lists/:id/tasks/:tid` (write permission) → 200, updates fields
- [x] AC-T3: `DELETE /api/task-lists/:id/tasks/:tid` (write permission) → 204
- [x] AC-T4: `PUT /api/task-lists/:id/tasks/reorder` with `{orderedIds:[]}` (write) → 200, order updated
- [x] AC-T5: READ-permission user calling POST/PATCH/DELETE on tasks → 403

## Shares (5 ACs)
- [x] AC-S1: `POST /api/task-lists/:id/shares` (owner) with email + permission → 201, creates share
- [x] AC-S2: `POST /api/task-lists/:id/shares` with non-existent email → 404
- [x] AC-S3: `GET /api/task-lists/:id/shares` (owner) → 200, lists all shares
- [x] AC-S4: `PATCH /api/task-lists/:id/shares/:sid` (owner) → 200, updates permission
- [x] AC-S5: `DELETE /api/task-lists/:id/shares/:sid` (owner) → 204, revokes access

## Templates (6 ACs)
- [x] AC-TP1: `POST /api/templates` → 201, creates template
- [x] AC-TP2: `GET /api/templates` → 200, returns only current user's templates
- [x] AC-TP3: `GET /api/templates/:id` (owner) → 200, with template tasks
- [x] AC-TP4: `PATCH /api/templates/:id` / `DELETE /api/templates/:id` (owner) → 200/204
- [x] AC-TP5: Template task CRUD (POST/PATCH/DELETE on `/templates/:id/tasks/:tid`)
- [x] AC-TP6: `POST /api/templates/:id/apply` with `{taskListId}` (write on list) → 201, appends tasks

## Security (4 ACs)
- [x] AC-SEC1: Non-owner cannot rename/delete task list → 403
- [x] AC-SEC2: Non-member cannot see task list at all → 404 (not 403, to not leak existence)
- [x] AC-SEC3: Template not owned by user → 404
- [x] AC-SEC4: Share invite for user who already has access → 409

## Frontend — Auth (2 ACs)
- [x] AC-FA1: Unauthenticated user visiting any page → redirected to /login
- [x] AC-FA2: Login/register form submits → sets cookie, redirects to /task-lists

## Frontend — Task Lists (2 ACs)
- [x] AC-FTL1: Create task list → appears in sidebar
- [x] AC-FTL2: Share modal → invite by email, show current shares

## Frontend — Mobile (2 ACs)
- [x] AC-FM1: At 375px viewport, sidebar is hidden by default
- [x] AC-FM2: Hamburger button opens/closes sidebar

---

## How to verify

All checks run inside Docker to match the real deployment environment.

### Backend API tests (both environments)

```bash
docker compose -f docker-compose.test.yml run --rm backend-test
# Expected: Test Files 6 passed, Tests 49 passed
```

### Dev environment

```bash
# Start the dev stack (auto-loads docker-compose.override.yml)
# Migrations run automatically on backend startup
docker compose up --build -d

# Verify stack is healthy
docker compose ps
# Expected: db, backend, frontend, nginx all running / healthy

# Smoke-test the API through nginx
curl -s http://localhost:8090/api/auth/me
# Expected: {"error":"Unauthorized"} (401)

# Frontend served by Vite dev server (hot reload on file changes)
curl -s http://localhost:8090/ | head -5
# Expected: HTML with <script type="module" ...> (Vite HMR script)

# Tear down
docker compose down
```

### Production environment

```bash
# Start the prod stack (migrations run automatically on backend startup)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d

# Verify stack is healthy
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
# Expected: db, backend, frontend all running / healthy

# Smoke-test the API through nginx (built into the frontend image)
curl -s http://localhost/api/auth/me
# Expected: {"error":"Unauthorized"} (401)

# Frontend served from pre-built static files
curl -s http://localhost/ | head -5
# Expected: HTML without Vite HMR, referencing hashed JS bundles

# E2E tests
cd e2e && npm ci && npx playwright test
cd ..

# Tear down
docker compose -f docker-compose.yml -f docker-compose.prod.yml down -v
```

---

## Status

**Backend API tests**: 49/49 passing ✅
**Frontend build**: passing ✅
**E2E tests (Playwright)**: 10/10 passing ✅

**All automated ACs complete: 34/34 ✅**
