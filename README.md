# Task App

Shared task lists for family and friends: lists, subtasks, drag-and-drop ordering, live updates, reusable templates, sharing with READ/WRITE permissions, and a small admin panel.

**Stack**: one Node.js process — Next.js (App Router) · React + Tailwind · SQLite (Drizzle ORM) · playwright-bdd for tests. No Docker required, no external database.

---

## Quick start

```bash
git clone <this repo> && cd task-app
cp .env.example .env        # defaults work for local dev
npm install
npm run dev                 # http://localhost:3000
```

The SQLite database file (`./data/app.db` by default) is created and migrated automatically on first request. To make yourself an admin, put your email in `ADMIN_EMAILS` in `.env` before registering (or before your next login).

## Testing

All functional requirements live as Gherkin scenarios in `features/` — they are the spec, and the `@ac`-tagged e2e scenarios are the acceptance criteria (`grep -A1 "@ac" features/e2e/*.feature`).

```bash
npm test              # everything: api + browser (chromium + mobile viewport)
npm run test:api      # 72 API scenarios (fast, no browser)
npm run test:e2e      # 26 browser scenarios, incl. mobile touch
```

Locally the test runner boots `next dev` on port 8099 automatically (or reuses one you've started). In CI it tests the production build. First run needs `npx playwright install chromium`.

## Deployment

See **[deploy/README.md](deploy/README.md)** for the three supported paths:

1. **Local machine + Tailscale** — `tailscale serve` gives HTTPS, tailnet-only access. Simplest.
2. **Any Linux VM** — systemd unit + Caddy for HTTPS (`deploy/task-app.service`, `deploy/Caddyfile.example`). Oracle Cloud's Always Free ARM tier is a good zero-cost option; a walkthrough is included.
3. **Docker (optional)** — a single `Dockerfile` for container fans. Nothing else needs Docker.

GitHub Actions runs the full BDD suite on every push/PR; deploys are opt-in via repo variables/secrets so forks work with zero setup.

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
