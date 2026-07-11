# Task App

Shared task lists for family and friends: lists, subtasks, drag-and-drop ordering, live-ish updates, reusable templates, sharing with READ/WRITE permissions, and a small admin panel. Installable as a PWA on desktop and mobile.

**Stack**: Next.js (App Router) · React + Tailwind · SQLite dialect via [libsql](https://github.com/tursodatabase/libsql) (Drizzle ORM) · playwright-bdd for tests. Deploys to **Vercel + Turso** for free.

<p align="center">
  <img src="screenshots/templating.png" width="280" alt="A Weekly Chores template with tasks and a subtask">
  &nbsp;&nbsp;
  <img src="screenshots/sharing.png" width="280" alt="Sharing a task list with READ/WRITE permissions">
</p>

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

The test runner boots `next dev` on port 8099 automatically (or reuses one you've started). First run needs `npx playwright install chromium`.

## Deployment

Deploys to **Vercel + Turso** — both free tiers cover a family-and-friends workload with enormous headroom, and there are no servers to maintain.

Environment keys (see `.env.example`): `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (remote DBs only), `JWT_SECRET`, `ADMIN_EMAILS` (optional), `COOKIE_SECURE` (local dev only — Vercel defaults to secure).

1. Fork or clone this repo to your GitHub account, then import it at [vercel.com/new](https://vercel.com/new). The build is preconfigured: Vercel runs `vercel-build` (applies pending Drizzle migrations to your database, then `next build`).
2. In the Vercel project, add the **Turso integration** from the Marketplace storage tab — it provisions a database and injects `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` automatically. (Alternatively, create a DB with the [Turso CLI](https://docs.turso.tech/cli) and set those two env vars by hand.)
3. Add env vars: `JWT_SECRET` (`openssl rand -hex 32`) and optionally `ADMIN_EMAILS`.
4. Deploy. Every later push to `main` deploys automatically; every PR gets a preview URL running against the same database — use a second Turso DB (or a [branched database](https://docs.turso.tech/features/branching)) for previews if you want isolation.

### Importing existing data

Turso can create a database directly from a SQLite file:

```bash
turso db create taskapp --from-file path/to/app.db
turso db show taskapp --url          # -> TURSO_DATABASE_URL
turso db tokens create taskapp      # -> TURSO_AUTH_TOKEN
```

If the file was written in WAL mode, produce a clean single-file copy first: `sqlite3 app.db "VACUUM INTO 'clean.db'"`.

### Backups

`turso db shell taskapp .dump > backup.sql`, or export back to a local file with `turso db export`. Cron it if you're paranoid — the whole database is tiny.

## Customizing

- Schema lives in `db/schema.ts` (Drizzle). After changing it: `npm run db:generate` writes SQL migrations to `drizzle/`, applied automatically on boot.
- API route handlers are in `app/api/`, one directory per resource, delegating to `lib/services/`.
- Pages/components are plain client-side React with react-query in `app/`, `components/`, `hooks/`.
- Add scenarios to `features/` first — the suite is the safety net that keeps your fork working.
