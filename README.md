# Task App

A full-stack task management application with sharing and templates.

**Stack**: React + Vite + Tailwind · Node.js + Fastify + Prisma · PostgreSQL · Caddy · nginx

---

## Development

```bash
docker compose up --build   # first time or after dependency changes
docker compose up           # day-to-day (hot reload via volume mount)
```

Migrations run automatically on backend startup. The frontend Vite dev server runs in a container with `./frontend/src` mounted for hot reload.
Access the app at **http://localhost:8090**.

---

## Production / VM Setup

### Prerequisites

- Azure VM (or any Ubuntu 22.04+ host) with Docker installed
- Ports 80 and 443 open
- A DNS name pointing at the VM's public IP (e.g. Azure DNS label: `<name>.<region>.cloudapp.azure.com`)

```bash
# Install Docker if needed
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker
```

### First-time deploy

```bash
git clone git@github.com:fanxia0404/task-app.git /app/task-app
cd /app/task-app
cp .env.example .env
nano .env   # fill in secrets (see below)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

> **Why `-f` flags?** `docker-compose.override.yml` is a dev-only file (Vite dev server, port 8090). Production must use only `docker-compose.yml` + `docker-compose.prod.yml` to get Caddy HTTPS + the built nginx image.

### Environment variables

| Variable | Description |
|---|---|
| `POSTGRES_PASSWORD` | Strong random password (avoid `/`, `+`, `=` or URL-encode them in `DATABASE_URL`) |
| `DATABASE_URL` | `postgresql://taskapp:<password>@db:5432/taskapp` |
| `JWT_SECRET` | At least 32 random characters |
| `COOKIE_SECURE` | `true` in production |
| `DOMAIN` | FQDN for Caddy's auto TLS (e.g. `task-app-fx.westus2.cloudapp.azure.com`) |

### Verify

```bash
curl https://<your-domain>/api/auth/me
# → {"error":"Unauthorized"}  (expected — API is working)
```

---

## CI / CD

Every push to `main` triggers the GitHub Actions workflow:

1. **Test** — runs backend API tests in Docker (`docker-compose.test.yml`), starts the full stack, runs Playwright E2E tests
2. **Deploy** — SSHes into the VM, pulls latest, rebuilds and restarts containers, runs migrations

### GitHub Secrets required

| Secret | Value |
|---|---|
| `VM_HOST` | Public IP or DNS of the VM |
| `VM_USER` | SSH username (e.g. `azureuser`) |
| `VM_SSH_KEY` | Private key for SSH access |

### Generate a deploy key (on the VM)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/deploy_key -N ""
cat ~/.ssh/deploy_key.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/deploy_key   # copy this → GitHub secret VM_SSH_KEY
```

---

## HTTPS

Caddy (in `docker-compose.prod.yml`) automatically obtains and renews a Let's Encrypt TLS certificate for the domain set in the `DOMAIN` environment variable. No manual certificate setup is needed — just ensure ports 80 and 443 are reachable and `DOMAIN` resolves to the VM's IP.

---

## Running tests manually

### Acceptance criteria tests

The acceptance criteria live as `@ac`-tagged Gherkin scenarios in `e2e/features/`. To see them:

```bash
grep -A1 "@ac" e2e/features/**/*.feature
```

To run them against the full stack:

```bash
docker compose -f docker-compose.yml -f docker-compose.test.yml up --build -d --wait -V
npm --prefix e2e install && BASE_URL=http://localhost:8099 npm --prefix e2e run test:ac
docker compose -f docker-compose.yml -f docker-compose.test.yml down
```

### Full test suite

```bash
# Backend BDD tests (API layer)
docker compose -f docker-compose.yml -f docker-compose.test.yml run --rm backend-test

# All E2E tests (clean DB, port 8099)
docker compose -f docker-compose.yml -f docker-compose.test.yml up --build -d --wait -V
npm --prefix e2e install && BASE_URL=http://localhost:8099 npm --prefix e2e test
docker compose -f docker-compose.yml -f docker-compose.test.yml down
```
