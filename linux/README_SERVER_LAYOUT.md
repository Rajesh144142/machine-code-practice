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
