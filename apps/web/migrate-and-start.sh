#!/bin/sh
set -e

echo "Starting production deployment..."

# Ensure NODE_ENV is set for production SSL configuration
export NODE_ENV=${NODE_ENV:-production}
echo "NODE_ENV: $NODE_ENV"

# If NODE_TLS_REJECT_UNAUTHORIZED is not already set and we're in production,
# check if it should be set for self-signed certificates
if [ -z "$NODE_TLS_REJECT_UNAUTHORIZED" ] && [ "$NODE_ENV" = "production" ]; then
  echo "Note: If using self-signed certificates, set NODE_TLS_REJECT_UNAUTHORIZED=0"
fi

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
echo "Starting PinSquirrel web application..."
pnpm --filter @pinsquirrel/web start