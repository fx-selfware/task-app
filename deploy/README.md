# Deploying task-app

Deploys to **Vercel + Turso** — both free tiers cover a family-and-friends workload with enormous headroom, and there are no servers to maintain.

Environment keys (see `.env.example`): `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (remote DBs only), `JWT_SECRET`, `ADMIN_EMAILS` (optional), `COOKIE_SECURE` (local dev only — Vercel defaults to secure).

## Vercel + Turso

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
