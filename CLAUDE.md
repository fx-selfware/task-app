# CLAUDE.md

## Workflow

- **Isolate work in a git worktree on its own branch**, never commit directly on `main`. Commit as you go, push the branch, and open a PR — don't push straight to `main` or merge without review.
- **Before opening the PR, run a subagent code review of the diff** covering both logic (correctness, edge cases, test coverage) and security (auth checks, input validation, injection). Fix what it finds, or note in the PR description why a finding was skipped.
- **Always run `npm run test:api`** after any change to `app/api/`, `lib/`, or `db/`. Do not consider work complete until it passes.
- **Always run `npm run test:e2e`** after any change to `app/` pages, `components/`, or `hooks/`. Do not consider work complete until it passes.
- **Mobile matters** — iOS Safari/Chrome and Android Chrome equally. Use `text-base sm:text-sm` on inputs to prevent auto-zoom, test touch interactions, respect mobile viewports.
- **Update all relevant docs** (CLAUDE.md + README.md) together, not just one.

## Commands

```bash
npm run dev             # dev server, http://localhost:3000 (needs .env — see .env.example)
npm run build           # production build (also the type-check)
npm test                # full BDD suite: api + chromium + mobile-chrome (boots its own server on :8099)
npm run test:api        # 73 API scenarios only (fast, no browser)
npm run test:e2e        # 26 browser scenarios only
npm run test:perf       # latency benchmark (builds, own server on :8098) — not part of `npm test`
npm run perf:compare before after   # diff two benchmark reports
npm run db:generate     # regenerate SQL migrations after editing db/schema.ts
npm run db:migrate      # apply migrations explicitly (Vercel runs this in vercel-build)
```

Tests reuse a dev server you already have on port 8099 (`TEST_PORT` overrides). `npx playwright install chromium` once per machine. Note: `next dev` and `next build` share `.next/`, so run `npm run build` again before `next start`-based smoke tests if you used the dev server since.

`package.json` has npm `overrides` pinning `next`'s nested `postcss` to `^8.5.10` (GHSA-qx2v-qp2m-jg93; every stable `next` through 16.2.10 still bundles 8.4.31) and `@esbuild-kit/core-utils`'s nested `esbuild` to `^0.25.0` (GHSA-67mh-4wv8-2f99, pulled in by `drizzle-kit`'s esm-loader). Remove the `next` override once a stable `next` ships with postcss >=8.5.10 (16.3.0+); remove the `esbuild-kit` override once `drizzle-kit` 1.0.0 stable (which drops `@esbuild-kit`) is released. If `npm install` doesn't apply an `overrides` change to an existing lockfile, delete `node_modules`/`package-lock.json` and reinstall clean.

## Architecture

Next.js App Router serves both the React UI and the JSON API. Persistence is the SQLite dialect via `@libsql/client`: a local file (`file:` URL) in dev/tests, a remote Turso database (`libsql://` URL) in production on Vercel. Same code, different URL. Production runs serverless — NO in-process state may be relied on (no module-scope caches, no pub/sub; that's why live updates are polling, not SSE).

```
Browser → Next.js → app/api/**/route.ts → lib/services/*.ts → libsql (Drizzle)
                  → app/**/page.tsx (client components, react-query, dnd-kit)
```

### Server

- `lib/db.ts` — `getDb(): Promise<Db>` memoized singleton. ASYNC: every drizzle call is awaited (`await ….get()/.all()/.run()`, `await db.batch([...])`). Two test-only hooks wrap the libsql client (`lib/dbInstrument.ts`), both inert unless their env var is set: `PERF_DB_LATENCY_MS` charges each round trip a delay for the benchmark, `EXPOSE_DB_METRICS` counts them into a response header for the round-trip budgets (`lib/dbMetrics.ts`). For `file:` URLs it enables WAL + FK enforcement and auto-applies `drizzle/` migrations on open; remote Turso gets migrations at build time (`vercel-build`) and enforces FKs server-side.
- **Round trips matter** (remote Turso pays network latency per statement) and are budgeted per endpoint in `features/api/round-trips.feature` — exceed one and the suite fails. Use `db.batch([...])` for anything multi-statement, including reads that don't depend on each other, and prefer it to `db.transaction()`: batch is equally atomic but costs one round trip where an interactive transaction pays for BEGIN, every statement, and COMMIT. Access checks are statements (`listRowStatement` + `myShareStatement` + `assertWriteAccess`) so services can batch them with the work they were doing anyway. No N+1 loops, and no unfiltered aggregates.
- `lib/auth.ts` — JWT in `token` HttpOnly cookie; `requireAuth(request)` returns the payload or throws 401; `requireAdmin` throws 403 for non-admins. Admin role driven by `ADMIN_EMAILS` env on register/login (promote AND demote). `middleware.ts` redirects app routes to `/login` when the cookie is *absent*, purely so the shell doesn't wait on `/api/auth/me`; it never inspects the token, and every route still calls `requireAuth`.
- Clients generate the id for rows they create and the server uses it (`lib/ids.ts`), which is what lets an optimistic row be acted on — add a subtask to a brand new task — before the response lands.
- `lib/apiHandler.ts` — `handle()` wraps every route handler; thrown `HttpError` → `{error}` JSON with its status.
- Live updates: `hooks/useTaskListEvents.ts` polls `GET /api/task-lists/:id/version` every 3s (one round trip, a few bytes) and refetches the list only when the token changes; `useTemplateEvents.ts` polls the template itself, which already costs one round trip. Both pause while the tab is hidden and while a mutation is in flight — a poll landing mid-write would answer with pre-mutation data and clobber the optimistic patch. There is no server push.
- Routes map 1:1 to resources under `app/api/`: auth, task-lists, tasks (nested), shares, templates, template-shares, admin. Each delegates to a matching `lib/services/` file.

### PWA

The app is installable. `app/manifest.ts` is the web manifest; icons (`app/icon.tsx`, `app/apple-icon.tsx`, and the manifest-sized `app/icon-192/route.tsx` / `app/icon-512/route.tsx`) are generated at build time with `next/og`'s `ImageResponse` from the shared mark in `app/icon-mark.tsx` — no binary image assets checked in. `public/sw.js`, registered by `components/ServiceWorkerRegister.tsx` from the root layout, is a minimal service worker: cache-first for content-hashed `_next/static/` assets (safe indefinitely — a new deploy ships new filenames), network-first for navigations with `/offline` as the fallback. It never intercepts `/api/*` — shared task data is never cached client-side, consistent with the polling-only live-update model above. Bump `CACHE_NAME` in `sw.js` if its caching logic changes.

### Database

Schema: `db/schema.ts` (Drizzle, SQLite). Data model: `users` (role USER/ADMIN) → `task_lists` → `tasks` (ordered by `order`, self-ref `parent_id` for subtasks) + `task_list_shares` (READ/WRITE). `task_templates` → `template_tasks` + `template_shares` (same model). IDs are cuid2 strings.

Schema change flow: edit `db/schema.ts` → `npm run db:generate` → commit the new `drizzle/*.sql`. It applies automatically on next boot for `file:` databases (dev, tests) and at build time on Vercel (`vercel-build` runs `drizzle-kit migrate` against Turso).

### Testing

One BDD toolchain (playwright-bdd), two layers, all features in `features/`:
- **api** — `features/api/*.feature` + `tests/steps/api/` — plain fetch against the app on :8099, DB reset per scenario (`tests/support/resetDb.ts`).
- **e2e** — `features/e2e/*.feature` + `tests/steps/e2e/` — real browser; `@touch-only` scenarios run in the mobile-chrome (Pixel 5) project only.

**Acceptance criteria** are `@ac`-tagged scenarios in `features/e2e/` — the scenario name *is* the AC. `grep -A1 "@ac" features/e2e/*.feature` to list them. Feature files are the spec: fix code, never bend a feature file to make a test pass.

**Round-trip budgets** live in `features/api/round-trips.feature`: each hot endpoint asserts a maximum number of database round trips, seeded with 20 rows so an N+1 fails rather than merely being slower.

**Optimistic UI** is specified in `features/e2e/optimistic.feature`: each scenario stalls the API before acting, so a passing assertion proves the UI rendered from the cache. Writes patch the cache in `onMutate`, splice the server's row in on success, roll back on failure, and report the failure through the shared toast. Don't reintroduce a blanket `invalidateQueries` after a mutation — it spends a round trip re-reading a list whose contents are already known.

**Performance** is measured separately by `tests/perf/` (plain Playwright, not BDD, own config and port). It delays every API request client-side (`PERF_NET_MS`) and charges each DB statement a simulated Turso round trip (`PERF_DB_MS`, injected by `lib/dbInstrument.ts` and inert unless `PERF_DB_LATENCY_MS` is set), then reports per interaction: **perceived** (click → UI updated), **settled** (click → last request done), and API calls. Optimistic UI moves perceived; batching round trips and dropping redundant refetches move settled. Label runs and diff them — see `tests/perf/README.md`. Always invoke via `npm run test:perf`; it rebuilds first, and running `playwright test` directly measures a stale build.

Cleanup: `tests/support/globalTeardown.ts` deletes every account the suite creates. To smoke-test a deployed instance, set `BASE_URL=https://…` AND export that instance's `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` so teardown can reach its database. Step assertions must poll (`expect(...).toPass()`), never fixed-sleep — remote-DB latency breaks sleeps.

### Environment variables

`TURSO_DATABASE_URL` (default `file:./data/app.db`; `libsql://…` in prod), `TURSO_AUTH_TOKEN` (remote DBs only), `JWT_SECRET` (required, 16+ chars), `COOKIE_SECURE` (defaults to secure when `VERCEL_ENV` is set; `false` for local http), `ADMIN_EMAILS` (optional, comma-separated). See `.env.example`.

### Deployment

Production is Vercel (git integration deploys `main`; PRs get preview URLs) + Turso via the Vercel Marketplace integration. See the Deployment section in README.md. Backups: `turso db shell <db> .dump`.
