# Linux Server Layout - Where Things Go (Web Apps)

This is a beginner‑friendly guide. It shows where files usually live on a Linux server and why.

## Common Folders (Simple Meaning)

- `/home` = user home folders
- `/etc` = configuration files
- `/var` = logs, caches, databases (things that change often)
- `/srv` = app code for services
- `/opt` = apps you install manually
- `/usr/local` = software you installed yourself

## Basic Web App Layout (Recommended)

### 1) App code (your repo)

Put it here:
- `/srv/myapp/`

Why:
- `/srv` is meant for service code.

### 2) Config and secrets

Put it here:
- `/etc/myapp/` (example: `/etc/myapp/.env`)

Why:
- `/etc` is for config files.

### 3) Logs

Put it here:
- App logs: `/var/log/myapp/`
- Nginx logs: `/var/log/nginx/`

Why:
- Logs change often, so they belong in `/var/log`.

### 4) Database data

Put it here:
- PostgreSQL: `/var/lib/postgresql/`
- MySQL: `/var/lib/mysql/`

Why:
- Databases store changing data in `/var/lib`.

### 5) Static files (React build)

Put it here:
- `/srv/myapp/public/` or `/var/www/myapp/`

### 6) SSL certificates

Put it here:
- Let’s Encrypt: `/etc/letsencrypt/`
- Manual certs: `/etc/ssl/` or `/etc/nginx/ssl/`

## Nginx (Reverse Proxy)

Where config goes:
- `/etc/nginx/`
- Ubuntu: `/etc/nginx/sites-available/` and `/etc/nginx/sites-enabled/`
- CentOS/RHEL: `/etc/nginx/conf.d/`

Why:
- Nginx reads its config from `/etc/nginx`.

## Systemd Service (Run the App)

Put the service file here:
- `/etc/systemd/system/myapp.service`

Why:
- System services live under `/etc/systemd/system`.

## Simple Example (Single Server)

You have one server with Node + React:
- Code: `/srv/myapp/`
- Config: `/etc/myapp/.env`
- React build: `/srv/myapp/public/`
- Logs: `/var/log/myapp/`
- Nginx config: `/etc/nginx/sites-available/myapp`
- SSL certs: `/etc/letsencrypt/live/myapp.com/`

## Full‑Stack Example (2 App Servers + 2 DB Servers + 1 Proxy)

### Goal

- Users hit one public IP
- Proxy spreads traffic to two app servers
- DB writes go to master, reads go to replica

### Proxy Server (Load Balancer)

What goes here:
- Nginx config: `/etc/nginx/sites-available/myapp`
- SSL certs: `/etc/letsencrypt/live/myapp.com/`
- Logs: `/var/log/nginx/`

Why:
- Proxy is the front door for users.

### App Server 1 and App Server 2

What goes here:
- App code: `/srv/myapp/`
- Config: `/etc/myapp/.env`
- React build: `/srv/myapp/public/`
- Logs: `/var/log/myapp/`
- Service: `/etc/systemd/system/myapp.service`

Why:
- Two app servers give scaling and failover.

### DB Master Server (Write)

What goes here:
- Data: `/var/lib/postgresql/` or `/var/lib/mysql/`
- Config: `/etc/postgresql/` or `/etc/mysql/`
- Logs: `/var/log/postgresql/` or `/var/log/mysql/`

Why:
- Only one DB accepts writes.

### DB Replica Server (Read)

What goes here:
- Data: `/var/lib/postgresql/` or `/var/lib/mysql/`
- Config: `/etc/postgresql/` or `/etc/mysql/`
- Logs: `/var/log/postgresql/` or `/var/log/mysql/`

Why:
- Replica handles heavy read traffic.

### Traffic Flow (Simple)

User → Proxy (Nginx) → App Server → DB (master for writes, replica for reads)

## Quick Rules (Easy To Remember)

- Code → `/srv`
- Config → `/etc`
- Logs → `/var/log`
- DB data → `/var/lib`
- SSL certs → `/etc/letsencrypt`

## Create Users and Assign Access

Create a user:
```bash
sudo adduser appuser
```

Add user to a group:
```bash
sudo usermod -aG www-data appuser
```

Give ownership of app code:
```bash
sudo chown -R appuser:www-data /srv/myapp
```

Set permissions:
```bash
sudo chmod -R 750 /srv/myapp
```

Meaning:
- App runs as `appuser`
- Nginx runs as `www-data`
- Group access lets Nginx read app files

## Should You Run the App as Root?

No. Run your app as a normal user.

Why:
- Root has full access. If the app is hacked, the whole server is at risk.

When to use root:
- Installing packages
- Editing system configs
- Binding to privileged ports (80/443) via Nginx

## What About DB, Nginx, and Other Services?

- App: run as a normal user (example: `appuser`)
- Database: run as its own service user (`postgres`, `mysql`)
- Nginx: runs as `www-data` or `nginx`
- Background workers (queues): run as a normal user or a service user
- Never run these as root
