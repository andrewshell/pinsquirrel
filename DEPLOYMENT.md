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

### Required Environment Variables

```bash
DATABASE_URL=postgresql://username:password@hostname:5432/database?sslmode=require
PORT=8100  # Optional, defaults to 8100
```

### Managed Database Configuration

For managed PostgreSQL databases (DigitalOcean, AWS RDS, etc.):

- Ensure SSL is enabled (typically required)
- Use connection pooling if provided by your host
- Set `sslmode=require` in the DATABASE_URL

## Deployment Options

### Option 1: DigitalOcean App Platform

1. Create new app from GitHub repository
2. Use `apps/hono/Dockerfile` as build configuration
3. Set `DATABASE_URL` environment variable
4. Deploy managed PostgreSQL database separately

### Option 2: Docker Compose with Dockge

```yaml
version: '3.8'
services:
  pinsquirrel:
    image: your-username/pinsquirrel:latest
    ports:
      - '8100:8100'
    environment:
      - DATABASE_URL=postgresql://pinsquirrel:pinsquirrel@postgres:5432/pinsquirrel
    depends_on:
      - postgres

  postgres:
    image: postgres:16
    environment:
      - POSTGRES_DB=pinsquirrel
      - POSTGRES_USER=pinsquirrel
      - POSTGRES_PASSWORD=pinsquirrel
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Option 3: Self-hosted with External Database

```bash
docker run -d \
  -p 8100:8100 \
  -e DATABASE_URL="postgresql://user:pass@your-db-host:5432/pinsquirrel?sslmode=require" \
  your-username/pinsquirrel:latest
```

## Migration Process Details

### Migration Script (`migrate-and-start.sh`)

```bash
#!/bin/sh
set -e

echo "Starting production deployment..."

# Run database migrations
echo "Running database migrations..."
pnpm --filter @pinsquirrel/database db:migrate

# Check migration exit code
if [ $? -ne 0 ]; then
  echo "Database migration failed! Exiting."
  exit 1
fi

echo "Database migrations completed successfully."

# Start the application
echo "Starting PinSquirrel Hono application..."
pnpm --filter @pinsquirrel/hono start
```

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
   psql "postgresql://user:pass@host:5432/db?sslmode=require"
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
# Running database migrations...
# Database migrations completed successfully.
# Starting PinSquirrel Hono application...
```

### Common Issues

1. **Database URL Connection String**:
   - Ensure proper encoding of special characters
   - Verify SSL configuration for managed databases
   - Check firewall rules and network connectivity

2. **Permission Issues**:
   - Database user needs schema creation permissions
   - Migration script must be executable (handled in Dockerfile)

3. **Dependency Issues**:
   - `drizzle-kit` must be in production dependencies
   - All workspace packages must be available in container

## Monitoring

### Health Checks

The application exposes a health check endpoint:

```bash
curl http://localhost:8100/health
# Returns: {"status":"ok"}
```

Use this endpoint to monitor:

- Application startup success
- Database connectivity
- Container readiness

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
