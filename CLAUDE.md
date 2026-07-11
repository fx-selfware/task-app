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
```

Tests reuse a dev server you already have on port 8099 (`TEST_PORT` overrides). `npx playwright install chromium` once per machine. Note: `next dev` and `next build` share `.next/`, so run `npm run build` again before `next start`-based smoke tests if you used the dev server since.

## Architecture

Single Node process: Next.js App Router serves both the React UI and the JSON API. SQLite is the whole persistence layer (one file, WAL mode, migrations auto-applied on boot by `lib/db.ts`).

```
Browser → Next.js → app/api/**/route.ts → lib/services/*.ts → SQLite (Drizzle)
                  → app/**/page.tsx (client components, react-query, dnd-kit)
```

### Server

- `lib/db.ts` — `getDb()` singleton: better-sqlite3 (SYNCHRONOUS — `.get()/.all()/.run()`, `db.transaction(cb)` sync) + Drizzle, runs `drizzle/` migrations on open.
- `lib/auth.ts` — JWT in `token` HttpOnly cookie; `requireAuth(request)` returns the payload or throws 401; `requireAdmin` throws 403 for non-admins. Admin role driven by `ADMIN_EMAILS` env on register/login (promote AND demote).
- `lib/apiHandler.ts` — `handle()` wraps every route handler; thrown `HttpError` → `{error}` JSON with its status.
- `lib/events.ts` + the `**/events/route.ts` SSE routes — in-process pub/sub for live updates (list channel = list id, template channel = `template:<id>`). Valid only while the app is one process.
- Routes map 1:1 to resources under `app/api/`: auth, task-lists, tasks (nested), shares, templates, template-shares, admin. Each delegates to a matching `lib/services/` file.

### Database

Schema: `db/schema.ts` (Drizzle, SQLite). Data model: `users` (role USER/ADMIN) → `task_lists` → `tasks` (ordered by `order`, self-ref `parent_id` for subtasks) + `task_list_shares` (READ/WRITE). `task_templates` → `template_tasks` + `template_shares` (same model). IDs are cuid2 strings.

Schema change flow: edit `db/schema.ts` → `npm run db:generate` → commit the new `drizzle/*.sql` — it applies automatically on next boot everywhere (dev, tests, prod).

### Testing

One BDD toolchain (playwright-bdd), two layers, all features in `features/`:
- **api** — `features/api/*.feature` + `tests/steps/api/` — plain fetch against the app on :8099, DB reset per scenario (`tests/support/resetDb.ts`).
- **e2e** — `features/e2e/*.feature` + `tests/steps/e2e/` — real browser; `@touch-only` scenarios run in the mobile-chrome (Pixel 5) project only.

**Acceptance criteria** are `@ac`-tagged scenarios in `features/e2e/` — the scenario name *is* the AC. `grep -A1 "@ac" features/e2e/*.feature` to list them. Feature files are the spec: fix code, never bend a feature file to make a test pass.

### Environment variables

`SQLITE_PATH` (default `./data/app.db`), `JWT_SECRET` (required, 16+ chars), `COOKIE_SECURE` (`false` dev, `true` behind HTTPS), `ADMIN_EMAILS` (optional, comma-separated). See `.env.example`.

### Deployment

Single process; see `deploy/README.md` (local + Tailscale, generic VM systemd + Caddy, Oracle Free ARM walkthrough, optional Dockerfile). CI (`.github/workflows/deploy.yml`): test job on every push/PR; deploy job only when repo variable `DEPLOY_ENABLED=true`, uses `DEPLOY_RUNNER` variable (`ubuntu-24.04-arm` for arm64 VMs — better-sqlite3 is a native module, build arch must match the VM) and secrets `VM_HOST`, `VM_USER`, `VM_SSH_KEY`; rsyncs the Next standalone output + `drizzle/` and restarts systemd. Backups = copy the SQLite file.

### History

v1 was Fastify+Prisma+Postgres+Docker (multi-container). `scripts/migrate-from-postgres.ts` migrates v1 data into SQLite. The Gherkin features carried over verbatim from v1 — scenario names are stable identifiers; don't rename them casually.
