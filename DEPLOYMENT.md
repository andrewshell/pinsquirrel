# Production Deployment

PinSquirrel ships as one Docker image built from `apps/hono/Dockerfile`, run behind a reverse
proxy (Caddy) with a MySQL 8 database alongside it.

## Build

```bash
# From the repo root. The build context is the whole monorepo.
docker build -f apps/hono/Dockerfile -t pinsquirrel:local .
```

## Publishing a release

The image is `ghcr.io/andrewshell/pinsquirrel`, built for `linux/amd64` and `linux/arm64`. It is
tagged with the root package's version and `latest`.

Merging the root package's release pull request publishes it. release-please tags the merge
`vX.Y.Z`, creates the GitHub release, and the `publish` job in
`.github/workflows/release-please.yml` starts. It runs `node scripts/release.ts --skip-gates` in
the `release` environment, with the workflow's `GITHUB_TOKEN` logged in to ghcr.io and QEMU so the
amd64 runner can build arm64 too. A Chrome extension release does not start it.

`scripts/release.ts` asks the registry whether the version's image exists
(`docker manifest inspect`, which pulls nothing). If it does, there is nothing to do. Otherwise it
pushes only from a checkout where:

- the tag `vX.Y.Z` exists and is in the history of HEAD.
- nothing has changed between the tag and HEAD outside `apps/chrome-extension` and
  `.release-please-manifest.json`, which an extension release rewrites. So the image is what was
  released.
- HEAD is `main`, clean and level with its upstream.

Then it checks Docker and the ghcr.io login, runs `pnpm quality` unless `--skip-gates` is given,
and runs `scripts/docker-build-push.sh --skip-gates`.

The job skips the quality gate. CI runs on every pull request to `main` and on the release merge
itself, but nothing makes the publish wait for it, and the `main` ruleset requires no checks. A
release pull request that release-please opens with the default `GITHUB_TOKEN` gets no CI at all,
because GitHub does not start workflows from that token's events. Its diff is only versions and
changelogs. Set `RELEASE_PLEASE_TOKEN` (below) to get CI on it.

To retry a failed publish, re-run the `publish` job, or run the `Release Please` workflow from the
Actions tab on `main`. A manual run skips release-please and goes straight to `publish`. The
script pushes only when the registry lacks the version, so a retry is safe. It works only while
`main` is still at the release commit. Any later commit, including a `docs:`, `ci:` or `chore:`
commit that release-please hides and that opens no release pull request, makes the script refuse.
Then the next root release publishes the version. When only hidden-type commits have landed, force
a release by adding a `Release-As: X.Y.Z` footer to a commit (see the release-please
documentation).

### One-time setup

- In the repository settings, create the environment `release` and limit its deployment branches
  to `main`. Without it, the first run creates the environment with no limit.
- The first push creates the ghcr.io package `pinsquirrel`. When the `publish` job makes that
  push, GitHub links the package to this repository and lets its workflows write to it. If you
  push the first image from your machine instead, open the package settings and, under **Manage
  Actions access**, give this repository the **Write** role. The `org.opencontainers.image.source`
  label in the Dockerfile links the package to this repository either way.
- A new package is private. To let servers pull it without a login, set its visibility to public
  in the package settings. Otherwise each server needs `docker login ghcr.io` with a token that
  has `read:packages`.
- Optional: store a fine-grained personal access token as the repository secret
  `RELEASE_PLEASE_TOKEN`, with **Contents** and **Pull requests** read and write on this
  repository, so release pull requests get CI. The release works without it.

### Moving a server from Docker Hub

Images used to go to Docker Hub as `andrewshell/pinsquirrel`. New versions go only to
`ghcr.io/andrewshell/pinsquirrel`. Nothing is on GHCR yet. The package appears when the `publish`
job pushes the next root release, and `v3.10.1` is never published there. The package starts
private. Keep running the Docker Hub image until that first image exists and the package is public
(or the server has `docker login ghcr.io` with a `read:packages` token). Only then change the image
name in the compose file, as in [Running it](#running-it), and pull it.

### From your machine

Use this when Actions is unavailable, after the release pull request merges:

```bash
git checkout main && git pull --prune --tags
pnpm release:dry-run   # the plan, and why
pnpm release           # pnpm quality, then <version> and latest
pnpm release beta      # the same, plus a custom tag
```

To push only an image, or to finish a release whose push failed, use the image script. It reads
the version from the root `package.json` and runs `pnpm quality` unless told not to:

```bash
pnpm docker:dry-run                           # the image, version and tags
pnpm docker:build-push                        # pnpm quality, then <version> and latest
pnpm docker:build-push -- --skip-gates beta   # after a run whose gate passed
```

From a machine, both need `docker login ghcr.io` with a personal access token that has
`write:packages`. Confirm a push carried both platforms with
`docker buildx imagetools inspect ghcr.io/andrewshell/pinsquirrel:<version>`.

## Migrations

The container entrypoint is [`apps/hono/migrate-and-start.sh`](./apps/hono/migrate-and-start.sh):
it defaults `NODE_ENV` to `production`, runs `drizzle-kit migrate`, exits non-zero if that fails,
and only then starts the app. So every container start applies pending migrations, and a
migration failure keeps the old schema from serving new code. The script's comments explain each
step (notably the `--config.verify-deps-before-run=false` flag the runtime image needs).

The database user needs CREATE, ALTER and DROP. Migrations are idempotent; nothing prevents two
instances migrating at once, so start one instance first after a release that carries a
migration.

The new container migrates while the old one may still be serving, and the old code runs against
the migrated schema until it stops. Stop the old container before the new one starts when a
migration rewrites data the old code reads. `20261118001008_hash_session_ids` is one: it replaces
each session id with its SHA-256, so the old code no longer finds any session. A user who reaches
the old container after the migration has their cookie cleared and must sign in again. A session
the old container creates after the migration is stored under the plain token, and the new code
cannot find it either. Rolling back to code from before that migration ends every session.

## Memory

Password hashing uses scrypt with N=2^17, which needs about 128 MiB per derivation. Node runs
derivations on the libuv thread pool, 4 threads by default, so concurrent sign-ins, sign-ups and
password changes can add about 512 MiB above the baseline. Size the container for that.

## Environment

`apps/hono/.env.example` is the template; the table below is what each variable does in
production.

| Variable               | Required             | Default                   | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------- | -------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`         | yes                  | —                         | MySQL connection string, e.g. `mysql://username:password@hostname:3306/database`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `NODE_ENV`             | yes in production    | `development`             | Anything other than `production` drops the `Secure` flag on the session cookie, so an unset value over HTTPS leaks the cookie                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `BASE_URL`             | yes in production    | `http://localhost:8100`   | The public origin, e.g. `https://pinsquirrel.com`. It is the OAuth issuer and the origin of both resource identifiers, so it is read from config rather than from the request — a spoofed `Host` header must not change what the server claims to be. Boot fails if it is unset when `NODE_ENV=production`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `PORT`                 | no                   | `8100`                    | HTTP listen port                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `LOG_LEVEL`            | no                   | `info`                    | Pino level (`trace`…`fatal`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `TRUST_PROXY`          | yes behind a proxy   | —                         | Set when a reverse proxy (Caddy here) terminates TLS, so the rate limiters key on the client address the proxy reports in `x-forwarded-for` (or `x-real-ip`). The headers count only when the connection comes from a trusted peer: with `1` (or any value that holds no address or CIDR range, such as `true`, `false`, `0` or a hostname like `caddy`), any loopback or private-network address (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `::1`, `fc00::/7`); with a comma-separated list of addresses and CIDR ranges, only those. Entries in a list that are not a valid address or CIDR range are dropped, and a list with none left behaves like `1`. So a value meant as "off" still trusts private ranges. To trust nothing, leave `TRUST_PROXY` unset. A connection from anywhere else is keyed on its own address, whatever headers it sends |
| `OAUTH_STATIC_CLIENTS` | no                   | —                         | JSON array of `{ client_id, client_name, redirect_uris }` objects, so an organisation can paste its own `client_id` when adding PinSquirrel as a custom connector. Reconciled into `oauth_clients` at boot as `static` registrations: created or updated, never deleted, so editing the config cannot sign a connector's users out. They are public clients with PKCE like every other client here — there is no secret. `client_id` must not be an http(s) URL (that form names a CIMD document), and each redirect URI must be https or http on loopback. A malformed value stops the process at boot                                                                                                                                                                                                                                                                       |
| `MAILGUN_API_KEY`      | no                   | —                         | Leave empty to disable password-reset and notification email entirely                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `MAILGUN_DOMAIN`       | with Mailgun         | —                         | Sending domain, e.g. `mg.yourdomain.com`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `MAILGUN_FROM_EMAIL`   | with Mailgun         | —                         | Envelope from address                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `MAILGUN_FROM_NAME`    | with Mailgun         | —                         | Display name on outgoing mail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `MAILGUN_BASE_URL`     | no                   | `https://api.mailgun.net` | Mailgun API base; set `https://api.eu.mailgun.net` for a domain in the EU region                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `NOTIFY_EMAIL`         | no                   | —                         | Address that receives a mail on each signup. The mail carries the new user's username and email address in plain text and goes through Mailgun, so leave it unset if you do not want addresses in that inbox                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `EMAIL_PUBLIC_KEY`     | no                   | —                         | When set, signup emails are sealed to this key and this server can never decrypt them. Generate with `pnpm --filter @pinsquirrel/crypto keygen`; the private half stays with the admin console, as that environment's `privateKeyPath`. Leave it unset and emails are stored as null: the console's entry for the environment then omits `privateKeyPath`, and it administers that environment with no unlock step and no waitlist mail                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `EMAIL_HASH_KEY`       | strongly recommended | —                         | Secret key for the stored email hash (HMAC-SHA256). Without it the hash is plain SHA-256, and anyone holding a copy of the database can test candidate addresses against it. Generate with `openssl rand -base64 32` (at least 32 characters). Accounts stored before the key was set are rewritten with the key the next time their address is used (sign-up, password reset, email change). Never change or lose the key: every keyed address would stop matching.                                                                                                                                                                                                                                                                                                                                                                                                          |

## Running it

```yaml
services:
  pinsquirrel:
    image: ghcr.io/andrewshell/pinsquirrel:latest
    ports:
      # Only Caddy on this host should reach the app.
      - '127.0.0.1:8100:8100'
    environment:
      - DATABASE_URL=mysql://pinsquirrel:pinsquirrel@mysql:3306/pinsquirrel
      - NODE_ENV=production
      - BASE_URL=https://pinsquirrel.com
      # The app sits behind Caddy, which sets x-forwarded-for.
      - TRUST_PROXY=1
    # The shutdown drain below needs at least 10 seconds.
    stop_grace_period: 10s
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

On `docker stop` the app stops taking requests and waits up to 8 seconds for sign-up and
password-reset mail still being sent. That drain needs a stop grace period of at least 10
seconds, and Docker does not always give you one: Docker Desktop 29 can kill a plain
`docker stop` after about 3 seconds, which cuts the drain short. Set `stop_grace_period: 10s`
in compose, or run `docker stop -t 10`. Mail the app gives up on is logged as `Abandoned
deferred account work at shutdown`; that user has to ask again.

## Rate limiting

Sign-in, sign-up, password reset, `/oauth/token`, `/oauth/revoke`,
`/oauth/register`, `/mcp` and `/api/v1/*` are all rate limited. Two things an
operator has to know:

- **The limiter keys on the client address, and only trusts a forwarding header
  when `TRUST_PROXY` is set and the connection comes from a trusted peer.**
  Behind the reverse proxy without it, every request buckets under the proxy's
  own address and one caller exhausts the budget for everyone. Publish the port
  on `127.0.0.1` as above: Docker's userland proxy can make an outside
  connection to a published port arrive from a private address, which
  `TRUST_PROXY=1` trusts. If Caddy connects from another machine, publish the
  port where Caddy can reach it and set `TRUST_PROXY` to Caddy's address.
- **Request bodies are capped.** The app answers 413 to a body over 64 KiB, or
  over 10 MiB on `/import`, before it reads the body.
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
