# Production Deployment Guide

This guide covers deploying PinSquirrel to production with automatic database migrations.

## Migration Strategy

PinSquirrel uses a **startup migration hook** pattern for production deployments. This ensures database migrations are automatically applied when the application starts or restarts.

### How It Works

1. **Migration Script**: `apps/hono/migrate-and-start.sh` runs migrations before starting the app
2. **Docker Integration**: The migration script is included in the production Docker image
3. **Automatic Execution**: Migrations run every time the container starts
4. **Error Handling**: If migrations fail, the application won't start

## Docker Build Process

### Build Command

```bash
# Build from monorepo root (required for proper build context)
docker build -f apps/hono/Dockerfile -t your-username/pinsquirrel:latest .

# Or use the convenience script (builds and pushes to Docker Hub)
pnpm docker:build-push
```

### What's Included

The production Docker image includes:

- Built Hono application
- Static assets (CSS, JS, images)
- Database migrations from `libs/database/src/migrations/`
- Migration script with proper permissions
- All necessary dependencies including `drizzle-kit`

## Environment Setup

### Environment Variables

`apps/hono/.env.example` is the template; the table below is what each variable
does in production.

| Variable               | Required           | Default                   | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------- | ------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`         | yes                | —                         | MySQL connection string, e.g. `mysql://username:password@hostname:3306/database`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `NODE_ENV`             | yes in production  | `development`             | Anything other than `production` drops the `Secure` flag on the session cookie, so an unset value over HTTPS leaks the cookie                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `BASE_URL`             | yes in production  | `http://localhost:8100`   | The public origin, e.g. `https://pinsquirrel.com`. It is the OAuth issuer and the origin of both resource identifiers, so it is read from config rather than from the request — a spoofed `Host` header must not change what the server claims to be. Boot fails if it is unset when `NODE_ENV=production`                                                                                                                                                                                                                                                                                              |
| `PORT`                 | no                 | `8100`                    | HTTP listen port                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `LOG_LEVEL`            | no                 | `info`                    | Pino level (`trace`…`fatal`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `TRUST_PROXY`          | yes behind a proxy | —                         | Set to any non-empty value when a reverse proxy (Caddy here) terminates TLS, so `x-forwarded-for`/`x-real-ip` are honoured for IP rate limiting. Leave unset when the app is reachable directly — otherwise a caller forges the header and every IP-keyed limiter is bypassable                                                                                                                                                                                                                                                                                                                         |
| `OAUTH_STATIC_CLIENTS` | no                 | —                         | JSON array of `{ client_id, client_name, redirect_uris }` objects, so an organisation can paste its own `client_id` when adding PinSquirrel as a custom connector. Reconciled into `oauth_clients` at boot as `static` registrations: created or updated, never deleted, so editing the config cannot sign a connector's users out. They are public clients with PKCE like every other client here — there is no secret. `client_id` must not be an http(s) URL (that form names a CIMD document), and each redirect URI must be https or http on loopback. A malformed value stops the process at boot |
| `MAILGUN_API_KEY`      | no                 | —                         | Leave empty to disable password-reset and notification email entirely                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `MAILGUN_DOMAIN`       | with Mailgun       | —                         | Sending domain, e.g. `mg.yourdomain.com`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `MAILGUN_FROM_EMAIL`   | with Mailgun       | —                         | Envelope from address                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `MAILGUN_FROM_NAME`    | with Mailgun       | —                         | Display name on outgoing mail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `MAILGUN_BASE_URL`     | no                 | `https://api.mailgun.net` | Mailgun API base; set `https://api.eu.mailgun.net` for a domain in the EU region                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `NOTIFY_EMAIL`         | no                 | —                         | Address that receives a notification on each signup                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `EMAIL_PUBLIC_KEY`     | no                 | —                         | When set, signup emails are sealed to this key and this server can never decrypt them. Generate with `pnpm --filter @pinsquirrel/crypto keygen`; the private half stays with the admin console                                                                                                                                                                                                                                                                                                                                                                                                          |

### Managed Database Configuration

For managed MySQL databases (DigitalOcean, AWS RDS, etc.):

- Use connection pooling if provided by your host
- Configure SSL at the client/server level if required by your provider

## Deployment Options

### Option 1: DigitalOcean App Platform

1. Create new app from GitHub repository
2. Use `apps/hono/Dockerfile` as build configuration
3. Set `DATABASE_URL`, `NODE_ENV=production` and `TRUST_PROXY=1` environment variables
4. Deploy managed MySQL database separately

### Option 2: Docker Compose with Dockge

```yaml
version: '3.8'
services:
  pinsquirrel:
    image: your-username/pinsquirrel:latest
    ports:
      - '8100:8100'
    environment:
      - DATABASE_URL=mysql://pinsquirrel:pinsquirrel@mysql:3306/pinsquirrel
      - NODE_ENV=production
      # The app sits behind Caddy, which sets x-forwarded-for.
      - TRUST_PROXY=1
    depends_on:
      - mysql

  mysql:
    image: mysql:8
    environment:
      - MYSQL_DATABASE=pinsquirrel
      - MYSQL_USER=pinsquirrel
      - MYSQL_PASSWORD=pinsquirrel
      - MYSQL_ROOT_PASSWORD=pinsquirrel
    volumes:
      - mysql_data:/var/lib/mysql

volumes:
  mysql_data:
```

### Option 3: Self-hosted with External Database

```bash
docker run -d \
  -p 8100:8100 \
  -e DATABASE_URL="mysql://user:pass@your-db-host:3306/pinsquirrel" \
  -e NODE_ENV=production \
  -e TRUST_PROXY=1 \
  your-username/pinsquirrel:latest
```

## Migration Process Details

### Migration Script (`migrate-and-start.sh`)

The container entrypoint is [`apps/hono/migrate-and-start.sh`](./apps/hono/migrate-and-start.sh).
It defaults `NODE_ENV` to `production`, runs `db:migrate`, exits non-zero if the
migration fails, and only then starts the app. Read the script rather than a copy
of it here — the comments explain why each step is the way it is (notably the
`--config.verify-deps-before-run=false` flag the runtime image needs).

### Migration Safety

- Migrations are idempotent (safe to run multiple times)
- Script exits if migrations fail (prevents app from starting with wrong schema)
- Drizzle handles migration versioning automatically
- No manual database operations required

## Troubleshooting

### Migration Failures

If migrations fail during startup:

1. **Check database connectivity**:

   ```bash
   # Test connection string
   mysql -h host -P 3306 -u user -p db
   ```

2. **Verify database permissions**:
   - User must have CREATE, ALTER, DROP permissions
   - User must be able to create tables and indexes

3. **Check migration files**:
   - Ensure all migration files are included in Docker image
   - Verify migration journal is up to date

### Container Logs

```bash
# View container logs to see migration progress
docker logs <container-id>

# Expected output:
# Starting production deployment...
# NODE_ENV: production
# Running database migrations...
# Database migrations completed successfully.
# Starting PinSquirrel Hono application...
```

### Common Issues

1. **Database URL Connection String**:
   - Ensure proper encoding of special characters
   - Configure SSL if required by your database provider
   - Check firewall rules and network connectivity

2. **Permission Issues**:
   - Database user needs schema creation permissions
   - Migration script must be executable (handled in Dockerfile)

3. **Dependency Issues**:
   - `drizzle-kit` must be in production dependencies
   - All workspace packages must be available in container

## Rate limiting

Sign-in, sign-up, password reset, `/oauth/token`, `/oauth/revoke`,
`/oauth/register`, `/mcp` and `/api/v1/*` are all rate limited. Two things an
operator has to know:

- **The limiter keys on the client address, and only trusts a forwarding header
  when `TRUST_PROXY` is set.** Behind the reverse proxy without it, every
  request buckets under the proxy's own address and one caller exhausts the
  budget for everyone.
- **The counters live in the process's own memory.** They are correct for a
  single instance and nothing else: two instances each enforce half the limit,
  and a restart forgets everything. Running more than one instance means moving
  the counters to a shared store (Redis or the database) first.

Anthropic egresses from `160.79.104.0/21`. Nothing here filters by address
today, but that is the range to allow if a WAF or a firewall rule ever sits in
front of `/mcp`, `/oauth/*` and the discovery documents. Blocking it blocks
every hosted Claude connector.

## Monitoring

### Health Checks

The application exposes a health check endpoint:

```bash
curl http://localhost:8100/health
```

Healthy — HTTP 200:

```json
{
  "status": "ok",
  "database": "connected",
  "uptime": 421,
  "timestamp": "2026-08-25T12:00:00.000Z"
}
```

Database unreachable — **HTTP 503**, with `status` `degraded` and an added
`error` field:

```json
{
  "status": "degraded",
  "database": "disconnected",
  "error": "database unavailable",
  "uptime": 421,
  "timestamp": "2026-08-25T12:00:00.000Z"
}
```

Point your orchestrator's health check at the status code, not the body: a
degraded response is a real 503, so container readiness follows database
connectivity without parsing JSON.

### Backup Strategy

Before major deployments:

1. Take database backup
2. Test migration on staging environment
3. Monitor logs during production deployment
4. Have rollback plan ready (restore from backup)

## Future Improvements

Consider these enhancements for larger scale deployments:

1. **Init Container Pattern**: Separate migration container for orchestrated environments
2. **Migration Locks**: Prevent concurrent migrations in multi-instance deployments
3. **Migration Monitoring**: Structured logging and metrics for migration tracking
4. **Backup Automation**: Automatic backups before migrations
