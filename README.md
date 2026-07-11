# Task App

Shared task lists for family and friends: lists, subtasks, drag-and-drop ordering, live-ish updates, reusable templates, sharing with READ/WRITE permissions, and a small admin panel.

**Stack**: Next.js (App Router) · React + Tailwind · SQLite dialect via [libsql](https://github.com/tursodatabase/libsql) (Drizzle ORM) · playwright-bdd for tests. Deploys to **Vercel + Turso** for free, or self-hosts as one Node process with a local SQLite file — same code, different `TURSO_DATABASE_URL`.

---

## Quick start

```bash
git clone <this repo> && cd task-app
cp .env.example .env        # defaults work for local dev
npm install
npm run dev                 # http://localhost:3000
```

Local dev uses an embedded SQLite file (`TURSO_DATABASE_URL=file:./data/app.db`), created and migrated automatically on first request — no database server, no Turso account needed. To make yourself an admin, put your email in `ADMIN_EMAILS` in `.env` before registering (or before your next login).

## Testing

All functional requirements live as Gherkin scenarios in `features/` — they are the spec, and the `@ac`-tagged e2e scenarios are the acceptance criteria (`grep -A1 "@ac" features/e2e/*.feature`).

```bash
npm test              # everything: api + browser (chromium + mobile viewport)
npm run test:api      # 72 API scenarios (fast, no browser)
npm run test:e2e      # 26 browser scenarios, incl. mobile touch
```

Locally the test runner boots `next dev` on port 8099 automatically (or reuses one you've started). In CI it tests the production build. First run needs `npx playwright install chromium`.

## Deployment

**Vercel + Turso (recommended, free):** import the repo at [vercel.com/new](https://vercel.com/new), add the Turso integration from the Vercel Marketplace (provisions the database and injects `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`), set `JWT_SECRET`, deploy. Pushes to `main` auto-deploy; PRs get preview URLs. Migrations run during the build (`vercel-build`).

**Self-host:** the same code runs as one Node process against a local SQLite file — no Turso account required. **Docker:** one optional `Dockerfile`. Details for all paths: **[deploy/README.md](deploy/README.md)**.

GitHub Actions runs the full BDD suite on every push/PR; deploys are Vercel's job, so forks need zero CI setup.

## Customizing

- Schema lives in `db/schema.ts` (Drizzle). After changing it: `npm run db:generate` writes SQL migrations to `drizzle/`, applied automatically on boot.
- API route handlers are in `app/api/`, one directory per resource, delegating to `lib/services/`.
- Pages/components are plain client-side React with react-query in `app/`, `components/`, `hooks/`.
- Add scenarios to `features/` first — the suite is the safety net that keeps your fork working.

## Migrating data from the v1 stack (Postgres)

If you ran the previous Fastify+Prisma+Postgres version, `scripts/migrate-from-postgres.ts` copies everything (including bcrypt password hashes — logins keep working) into a fresh SQLite file and verifies row counts + foreign-key integrity:

```bash
PG_URL=postgresql://user:pass@localhost:5432/taskapp SQLITE_PATH=./data/app.db npx tsx scripts/migrate-from-postgres.ts
```

The resulting file can be used directly (`TURSO_DATABASE_URL=file:./data/app.db`) or imported into Turso: `turso db create taskapp --from-file data/app.db`.
