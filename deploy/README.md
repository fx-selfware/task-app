# Deploying task-app

The app is a single Node process (Next.js standalone) with a SQLite database file. No Docker, no external database. Pick one of the three paths below.

Required environment: `JWT_SECRET` (32+ random chars), `COOKIE_SECURE` (`true` behind HTTPS), `SQLITE_PATH` (defaults to `./data/app.db`), optional `ADMIN_EMAILS` (comma-separated; those accounts get the admin panel).

## 1. Local machine on your Tailscale network (simplest)

Great for a home server or spare machine; only devices on your tailnet can reach it, with HTTPS handled by Tailscale.

```bash
npm ci && npm run build
JWT_SECRET=$(openssl rand -hex 32) COOKIE_SECURE=true ADMIN_EMAILS=you@example.com npm start
tailscale serve --bg 3000        # exposes https://<machine>.<tailnet>.ts.net
```

To auto-start on boot, adapt `deploy/task-app.service` (see below) or use a process manager you like.

## 2. Any Linux VM (systemd + Caddy)

Works on any VM with ~512 MB+ free RAM. On 1 GB machines, build in CI and rsync the artifact instead of building on the VM (see CI section) — `next build` is the only memory-hungry step. Also add a small swap file; tiny VMs without swap eventually OOM from OS background services alone (we learned this the hard way, see docs/incident-2026-04-12-app-down.md).

One-time setup as root:

```bash
# Node 22 (via NodeSource, or use fnm/nvm)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs
useradd --system --home /opt/task-app taskapp
mkdir -p /opt/task-app /var/lib/task-app && chown taskapp:taskapp /opt/task-app /var/lib/task-app
cp deploy/task-app.service /etc/systemd/system/
systemctl edit task-app        # set JWT_SECRET, COOKIE_SECURE=true, ADMIN_EMAILS
systemctl enable task-app
# Caddy for HTTPS: https://caddyserver.com/docs/install — then use deploy/Caddyfile.example
```

Each deploy (manual or from CI):

```bash
npm ci && npm run build
cp -r .next/static .next/standalone/.next/static
cp -r drizzle .next/standalone/drizzle
rsync -a --delete .next/standalone/ user@vm:/opt/task-app/
ssh user@vm sudo systemctl restart task-app
```

Migrations run automatically on boot. Backups: copy `/var/lib/task-app/app.db` anywhere (it's one file); `sqlite3 app.db ".backup backup.db"` for a consistent snapshot while running.

## 3. Oracle Cloud Always Free (recommended free VM)

Oracle's Always Free tier includes Ampere ARM VMs (up to 4 OCPU / 24 GB RAM total) — roomy enough to build on the VM itself.

1. Create an account at oracle.com/cloud/free, then an **Ampere A1 Compute** instance (Ubuntu 24.04). 2+ OCPU / 4+ GB is plenty.
2. In the instance's subnet **Security List**, add ingress rules for TCP 80 and 443 (and keep 22).
3. On the VM, Ubuntu's own firewall also filters: `sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT` and same for 443 (or manage via ufw), and persist with `netfilter-persistent`.
4. Follow path 2 above. **Note the VM is arm64** — if you deploy prebuilt artifacts from CI, the build must run on an ARM runner (set the `DEPLOY_RUNNER` repo variable to `ubuntu-24.04-arm`, free for public repos). Building on the VM avoids the issue entirely.
5. Point your domain's A/AAAA record at the VM's public IP; Caddy gets certificates automatically.

## CI deploys (GitHub Actions)

`.github/workflows/deploy.yml` runs tests on every push to main. Deploys are opt-in so forks work with zero setup:

- Repo **variable** `DEPLOY_ENABLED=true` turns the deploy job on.
- Repo **variable** `DEPLOY_RUNNER` (optional): `ubuntu-24.04-arm` when your VM is arm64 (native module `better-sqlite3` must match the VM's architecture).
- Repo **secrets**: `VM_HOST`, `VM_USER`, `VM_SSH_KEY` (private key whose public half is in the VM user's authorized_keys). The VM user needs passwordless restart rights:
  `echo 'youruser ALL=NOPASSWD: /usr/bin/systemctl restart task-app' | sudo tee /etc/sudoers.d/task-app`

## Optional: Docker

A single optional `Dockerfile` is provided for people who prefer containers: `docker build -t task-app . && docker run -p 3000:3000 -v taskapp-data:/data -e JWT_SECRET=... task-app`. Nothing else in dev, test, or deploy requires Docker.
