# Production Deployment

PinSquirrel ships as one Docker image built from `apps/hono/Dockerfile`, run behind a reverse
proxy (Caddy) with a MySQL 8 database alongside it.

## Build

```bash
# From the repo root — the build context is the whole monorepo
docker build -f apps/hono/Dockerfile -t andrewshell/pinsquirrel:latest .

# Or the script, which runs `pnpm quality` first and pushes to Docker Hub
pnpm docker:build-push
pnpm docker:build-push-skip-quality   # skip the gate
pnpm docker:dry-run                   # build only
```

## Migrations

The container entrypoint is [`apps/hono/migrate-and-start.sh`](./apps/hono/migrate-and-start.sh):
it defaults `NODE_ENV` to `production`, runs `drizzle-kit migrate`, exits non-zero if that fails,
and only then starts the app. So every container start applies pending migrations, and a
migration failure keeps the old schema from serving new code. The script's comments explain each
step (notably the `--config.verify-deps-before-run=false` flag the runtime image needs).

The database user needs CREATE, ALTER and DROP. Migrations are idempotent; nothing prevents two
instances migrating at once, so start one instance first after a release that carries a
migration.

## Environment

`apps/hono/.env.example` is the template; the table below is what each variable does in
production.

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
| `EMAIL_PUBLIC_KEY`     | no                 | —                         | When set, signup emails are sealed to this key and this server can never decrypt them. Generate with `pnpm --filter @pinsquirrel/crypto keygen`; the private half stays with the admin console, as that environment's `privateKeyPath`. Leave it unset and emails are stored as null: the console's entry for the environment then omits `privateKeyPath`, and it administers that environment with no unlock step and no waitlist mail                                                                                                                                                                 |

## Running it

```yaml
services:
  pinsquirrel:
    image: andrewshell/pinsquirrel:latest
    ports:
      - '8100:8100'
    environment:
      - DATABASE_URL=mysql://pinsquirrel:pinsquirrel@mysql:3306/pinsquirrel
      - NODE_ENV=production
      - BASE_URL=https://pinsquirrel.com
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

Startup logs read `Running database migrations...` → `Database migrations completed
successfully.` → `Starting PinSquirrel Hono application...`; a stop before the last line is a
migration failure, and the error above it is the one to read.

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

## Health check

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
