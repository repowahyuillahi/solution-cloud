# Deployment Guide — Web UI Absensi

This guide describes how to deploy the Web UI Absensi multi-tenant SaaS to a production server.

## Prerequisites

- Linux server (Ubuntu 22.04+ recommended)
- Docker 24+ and docker compose v2 (or Node.js 20+ if running natively)
- Domain name pointed to the server (`wflab.web.id` and any tenant custom domains)
- Reverse proxy (nginx or Caddy) for SSL termination
- At least 2GB RAM and 20GB disk for moderate usage

## Quick Start (Docker)

```bash
# 1. Clone the repository
git clone https://github.com/repowahyuillahi/solution-cloud.git
cd solution-cloud

# 2. Configure environment
cp .env.example .env
# Edit .env and set SESSION_SECRET, OWNER_PASSWORD, etc.

# 3. Build and run
docker compose up -d

# 4. Check health
curl https://your-domain.com/api/health
```

## Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SESSION_SECRET` | At least 32 random characters. Generate via `openssl rand -base64 48`. | Yes |
| `OWNER_USERNAME` | Platform owner username for `/admin/login`. | Yes |
| `OWNER_PASSWORD` | Strong password for the owner. Default values are blocked in production. | Yes |
| `NODE_ENV` | Must be `production` for production deployments. | Yes |
| `PORT` | App port (default `3000`). | No |
| `LOG_LEVEL` | `debug` / `info` / `warn` / `error`. Default `info`. | No |
| `MASTER_DATABASE_URL` | Override master DB path. Default `file:./databases/master.sqlite`. | No |

## Initial Setup

The first time you deploy, the entrypoint script will:

1. Create `databases/`, `data/`, `backups/`, `uploads/` directories
2. Apply the master schema via `prisma db push`
3. Seed the platform owner account (if not exists)
4. Seed the first tenant `tjahaja-baru` (optional, can be skipped)

You can verify the setup by logging in to `/admin/login` with your `OWNER_USERNAME` and `OWNER_PASSWORD`.

## Reverse Proxy

See `deploy/nginx.example.conf` for an nginx configuration example. Key points:

- Forward `X-Forwarded-For` and `X-Real-IP` so rate limiting and audit logs work correctly
- Disable proxy buffering for SSE endpoints (`/api/[slug]/download/bulk`)
- Set `client_max_body_size 10M` for logo / Excel uploads
- Use Let's Encrypt for SSL certificates

## Backups

Schedule the backup script via cron:

```cron
# Daily backup at 2 AM, retain 30 days
0 2 * * * cd /path/to/solution-cloud && /usr/bin/npx tsx scripts/backup-databases.ts >> /var/log/web-absensi-backup.log 2>&1
```

For DownloadHistory cleanup (retain 90 days):

```cron
# Weekly cleanup at 3 AM Sunday
0 3 * * 0 cd /path/to/solution-cloud && /usr/bin/npx tsx scripts/cleanup-download-history.ts >> /var/log/web-absensi-cleanup.log 2>&1
```

## Volumes

The Docker Compose setup mounts these directories:

- `databases/` — SQLite files (one per tenant + master)
- `data/` — Downloaded `.dat` attendance log files per tenant
- `backups/` — Archived data and DB backups
- `uploads/` — Uploaded tenant logos

Make sure these directories exist on the host and are writable by the container user.

## Custom Domains

To support tenant-specific custom domains (e.g., `absensi.client-company.com`):

1. The tenant configures their custom domain in `/portal/domain`
2. The customer points their domain (CNAME or A record) to your server
3. nginx must be configured to accept that domain (use wildcard `*.wflab.web.id` or add explicit `server_name` blocks)
4. The app middleware will detect the host header and resolve the tenant automatically

## Monitoring

- `GET /api/health` — Health endpoint, returns 200 (healthy) or 503 (degraded)
- Logs written to stdout/stderr in JSON format (use `docker logs` or pipe to a log aggregator)

## Updating

```bash
git pull
docker compose build --no-cache
docker compose up -d
```

Schema changes will be applied automatically by `prisma db push` in the entrypoint.

## Troubleshooting

### App refuses to start with "FATAL SESSION_SECRET"
Set a proper `SESSION_SECRET` value (at least 32 chars, not the default placeholder).

### App refuses to start with "FATAL OWNER_PASSWORD"
The default owner password is blocked in production. Set a strong unique password in `.env`.

### Tenant DB not provisioned during register
Verify `npx prisma` is available in the container PATH and the schema file is included.

### Cross-tenant access errors
This is expected behavior — every `/api/[slug]/*` endpoint enforces that the session's tenant matches the URL slug.
