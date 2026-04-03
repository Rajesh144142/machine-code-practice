# Linux Server Layout - Where Things Go (Web Apps)

This guide shows common locations for a full‑stack app on Linux. Paths can vary slightly by distro, but these are the usual defaults.

## Common Folders (Quick Meaning)

- `/home` - user home directories
- `/var` - variable data (logs, caches, databases)
- `/etc` - system config files
- `/opt` - optional apps you install manually
- `/srv` - service data (app files)
- `/usr/local` - manually installed software

## Recommended Layout For A Web App

### App code (repo)

Common choices:
- `/srv/myapp/` (clean, service‑oriented)
- `/opt/myapp/` (if you install as a package/app)
- `/home/ubuntu/myapp/` (simple, but less “server‑style”)

Recommendation: `/srv/myapp/`

### Environment files / secrets

- `/etc/myapp/` for config files
- Use `.env` under app only if locked down: `chmod 600`

### Logs

- App logs: `/var/log/myapp/`
- Nginx logs: `/var/log/nginx/`

### Database data

- PostgreSQL: `/var/lib/postgresql/`
- MySQL/MariaDB: `/var/lib/mysql/`

### Static files / uploads

- `/var/www/myapp/` or `/srv/myapp/public/`

### SSL certificates

- Let’s Encrypt: `/etc/letsencrypt/`
- Manual certs: `/etc/ssl/` or `/etc/nginx/ssl/`

## Nginx (Reverse Proxy)

- Config files: `/etc/nginx/`
- Site configs:
  - Debian/Ubuntu: `/etc/nginx/sites-available/` and `/etc/nginx/sites-enabled/`
  - RHEL/CentOS: `/etc/nginx/conf.d/`

## Systemd Services (App Process)

- Service files: `/etc/systemd/system/myapp.service`

## Example Real‑World Setup

- App code: `/srv/myapp/`
- App env: `/etc/myapp/.env`
- App logs: `/var/log/myapp/`
- Nginx config: `/etc/nginx/sites-available/myapp`
- SSL certs: `/etc/letsencrypt/live/myapp.com/`
- DB data: `/var/lib/postgresql/`

## Full‑Stack Example (Story)

Scenario:
- Backend: Node.js API (2 app servers)
- Frontend: React (served by Nginx)
- DB: 1 master + 1 replica
- 1 proxy/load balancer with round‑robin

### Proxy Server (load balancer)

Purpose: single public entry point, SSL, and routing.
- Nginx config: `/etc/nginx/sites-available/myapp`
- SSL certs: `/etc/letsencrypt/live/myapp.com/`
- Access logs: `/var/log/nginx/`

Why: clients hit one IP, proxy distributes traffic to app servers.

### App Server 1 and App Server 2

Purpose: run Node API and serve React build.
- App code: `/srv/myapp/`
- Backend env: `/etc/myapp/.env`
- React build: `/srv/myapp/public/` or `/var/www/myapp/`
- App logs: `/var/log/myapp/`
- Service file: `/etc/systemd/system/myapp.service`

Why: scaling horizontally and rolling deploys.

### DB Master Server

Purpose: write traffic only.
- Data files: `/var/lib/postgresql/` or `/var/lib/mysql/`
- Config: `/etc/postgresql/` or `/etc/mysql/`
- Logs: `/var/log/postgresql/` or `/var/log/mysql/`

Why: single source of truth for writes.

### DB Replica Server

Purpose: read traffic only.
- Data files: `/var/lib/postgresql/` or `/var/lib/mysql/`
- Config: `/etc/postgresql/` or `/etc/mysql/`
- Logs: `/var/log/postgresql/` or `/var/log/mysql/`

Why: offload heavy read queries from master.

### Traffic Flow (Simple)

User → Proxy (Nginx, SSL) → App Server (API + React) → DB Master/Replica

Reads go to replica, writes go to master.

## Quick Rules

- Code in `/srv` or `/opt`
- Config in `/etc`
- Logs in `/var/log`
- DB data in `/var/lib`
- Certs in `/etc/letsencrypt`

## Create Users and Assign Access

Create a user:
```bash
sudo adduser appuser
```

Add user to a group:
```bash
sudo usermod -aG www-data appuser
```

Give ownership of an app folder:
```bash
sudo chown -R appuser:www-data /srv/myapp
```

Set permissions:
```bash
sudo chmod -R 750 /srv/myapp
```

Real life example:
- App runs as `appuser`
- Nginx runs as `www-data`
- Group access lets Nginx read app files without giving full access to everyone
