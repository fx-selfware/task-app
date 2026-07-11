# Task App

Shared task lists for family and friends: lists, subtasks, drag-and-drop ordering, live-ish updates, reusable templates, sharing with READ/WRITE permissions, and a small admin panel. Installable as a PWA on desktop and mobile.

**Stack**: Next.js (App Router) · React + Tailwind · SQLite dialect via [libsql](https://github.com/tursodatabase/libsql) (Drizzle ORM) · playwright-bdd for tests. Deploys to **Vercel + Turso** for free.

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

**Vercel + Turso:** import the repo at [vercel.com/new](https://vercel.com/new), add the Turso integration from the Vercel Marketplace (provisions the database and injects `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`), set `JWT_SECRET`, deploy. Pushes to `main` auto-deploy; PRs get preview URLs. Migrations run during the build (`vercel-build`). Details: **[deploy/README.md](deploy/README.md)**.

## Customizing

- Schema lives in `db/schema.ts` (Drizzle). After changing it: `npm run db:generate` writes SQL migrations to `drizzle/`, applied automatically on boot.
- API route handlers are in `app/api/`, one directory per resource, delegating to `lib/services/`.
- Pages/components are plain client-side React with react-query in `app/`, `components/`, `hooks/`.
- Add scenarios to `features/` first — the suite is the safety net that keeps your fork working.
