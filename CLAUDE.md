# CLAUDE.md

## CRITICAL — Read First

**NEVER create git commits or amend existing commits unless the user explicitly says "commit".** Completing an edit, fixing a bug, or passing tests does NOT mean you should commit. Wait for the user to ask.

## Workflow Rules

- **Always run `npm run test:api`** after any change to `app/api/`, `lib/`, or `db/`. Do not consider work complete until it passes.
- **Always run `npm run test:e2e`** after any change to `app/` pages, `components/`, or `hooks/`. Do not consider work complete until it passes.
- **Mobile matters** — iOS Safari/Chrome and Android Chrome equally. Use `text-base sm:text-sm` on inputs to prevent auto-zoom, test touch interactions, respect mobile viewports.
- **Update all relevant docs** (CLAUDE.md + README.md) together, not just one.

## Commands

```bash
npm run dev             # dev server, http://localhost:3000 (needs .env — see .env.example)
npm run build           # production build (also the type-check)
npm test                # full BDD suite: api + chromium + mobile-chrome (boots its own server on :8099)
npm run test:api        # 72 API scenarios only (fast, no browser)
npm run test:e2e        # 26 browser scenarios only
npm run db:generate     # regenerate SQL migrations after editing db/schema.ts
npm run db:migrate      # apply migrations explicitly (Vercel runs this in vercel-build)
```

Tests reuse a dev server you already have on port 8099 (`TEST_PORT` overrides). `npx playwright install chromium` once per machine. Note: `next dev` and `next build` share `.next/`, so run `npm run build` again before `next start`-based smoke tests if you used the dev server since.

## Architecture

Next.js App Router serves both the React UI and the JSON API. Persistence is the SQLite dialect via `@libsql/client`: a local file (`file:` URL) in dev/tests/self-host, a remote Turso database (`libsql://` URL) in production on Vercel. Same code, different URL. Production runs serverless — NO in-process state may be relied on (no module-scope caches, no pub/sub; that's why live updates are polling, not SSE).

```
Browser → Next.js → app/api/**/route.ts → lib/services/*.ts → libsql (Drizzle)
                  → app/**/page.tsx (client components, react-query, dnd-kit)
```

### Server

- `lib/db.ts` — `getDb(): Promise<Db>` memoized singleton. ASYNC: every drizzle call is awaited (`await ….get()/.all()/.run()`, `await db.transaction(async (tx) => …)`). For `file:` URLs it enables WAL + FK enforcement and auto-applies `drizzle/` migrations on open; remote Turso gets migrations at build time (`vercel-build`) and enforces FKs server-side.
- **Round trips matter** (remote Turso pays network latency per statement): use `db.batch([...])` for multi-statement writes (see `reorderTasks`) and joins/`inArray` instead of per-row lookups. Don't reintroduce N+1 loops.
- `lib/auth.ts` — JWT in `token` HttpOnly cookie; `requireAuth(request)` returns the payload or throws 401; `requireAdmin` throws 403 for non-admins. Admin role driven by `ADMIN_EMAILS` env on register/login (promote AND demote).
- `lib/apiHandler.ts` — `handle()` wraps every route handler; thrown `HttpError` → `{error}` JSON with its status.
- Live updates: `hooks/useTaskListEvents.ts` / `useTemplateEvents.ts` poll (react-query invalidation every 3s, paused when the tab is hidden). There is no server push.
- Routes map 1:1 to resources under `app/api/`: auth, task-lists, tasks (nested), shares, templates, template-shares, admin. Each delegates to a matching `lib/services/` file.

### PWA

The app is installable. `app/manifest.ts` is the web manifest; icons (`app/icon.tsx`, `app/apple-icon.tsx`, and the manifest-sized `app/icon-192/route.tsx` / `app/icon-512/route.tsx`) are generated at build time with `next/og`'s `ImageResponse` from the shared mark in `app/icon-mark.tsx` — no binary image assets checked in. `public/sw.js`, registered by `components/ServiceWorkerRegister.tsx` from the root layout, is a minimal service worker: cache-first for content-hashed `_next/static/` assets (safe indefinitely — a new deploy ships new filenames), network-first for navigations with `/offline` as the fallback. It never intercepts `/api/*` — shared task data is never cached client-side, consistent with the polling-only live-update model above. Bump `CACHE_NAME` in `sw.js` if its caching logic changes.

### Database

Schema: `db/schema.ts` (Drizzle, SQLite). Data model: `users` (role USER/ADMIN) → `task_lists` → `tasks` (ordered by `order`, self-ref `parent_id` for subtasks) + `task_list_shares` (READ/WRITE). `task_templates` → `template_tasks` + `template_shares` (same model). IDs are cuid2 strings.

Schema change flow: edit `db/schema.ts` → `npm run db:generate` → commit the new `drizzle/*.sql`. It applies automatically on next boot for `file:` databases (dev, tests, self-host) and at build time on Vercel (`vercel-build` runs `drizzle-kit migrate` against Turso).

### Testing

One BDD toolchain (playwright-bdd), two layers, all features in `features/`:
- **api** — `features/api/*.feature` + `tests/steps/api/` — plain fetch against the app on :8099, DB reset per scenario (`tests/support/resetDb.ts`).
- **e2e** — `features/e2e/*.feature` + `tests/steps/e2e/` — real browser; `@touch-only` scenarios run in the mobile-chrome (Pixel 5) project only.

**Acceptance criteria** are `@ac`-tagged scenarios in `features/e2e/` — the scenario name *is* the AC. `grep -A1 "@ac" features/e2e/*.feature` to list them. Feature files are the spec: fix code, never bend a feature file to make a test pass.

Cleanup: `tests/support/globalTeardown.ts` deletes every account the suite creates. To smoke-test a deployed instance, set `BASE_URL=https://…` AND export that instance's `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` so teardown can reach its database. Step assertions must poll (`expect(...).toPass()`), never fixed-sleep — remote-DB latency breaks sleeps.

### Environment variables

`TURSO_DATABASE_URL` (default `file:./data/app.db`; `libsql://…` in prod), `TURSO_AUTH_TOKEN` (remote DBs only), `JWT_SECRET` (required, 16+ chars), `COOKIE_SECURE` (defaults to secure when `VERCEL_ENV` is set; `false` for local http), `ADMIN_EMAILS` (optional, comma-separated). See `.env.example`.

### Deployment

Production is Vercel (git integration deploys `main`; PRs get preview URLs) + Turso via the Vercel Marketplace integration. CI (`.github/workflows/deploy.yml`) runs tests only. Self-host and Docker paths in `deploy/README.md` use the same code with a `file:` URL. Backups: `turso db shell <db> .dump` (prod) or copy the SQLite file (self-host).

### History

v1 was Fastify+Prisma+Postgres+Docker (multi-container). `scripts/migrate-from-postgres.ts` migrates v1 data into SQLite. The Gherkin features carried over verbatim from v1 — scenario names are stable identifiers; don't rename them casually.
