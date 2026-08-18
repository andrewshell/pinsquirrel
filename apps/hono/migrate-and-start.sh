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

# This image carries only the workspace packages the app needs at runtime, so
# pnpm's pre-run dependency check sees an incomplete workspace and fails
# resolving workspace:* deps whose package.json was never copied. Dependencies
# are already installed and frozen by the image build, so there is nothing for
# the check to catch. It is passed per-invocation because pnpm reads this
# setting from neither the environment nor .npmrc -- the only other home for it
# would be pnpm-workspace.yaml, which would disable the check for developers
# and CI too.
PNPM_NO_DEP_CHECK="--config.verify-deps-before-run=false"

# Run database migrations
echo "Running database migrations..."
pnpm $PNPM_NO_DEP_CHECK --filter @pinsquirrel/database db:migrate

# Check migration exit code
if [ $? -ne 0 ]; then
  echo "Database migration failed! Exiting."
  exit 1
fi

echo "Database migrations completed successfully."

# Start the application
echo "Starting PinSquirrel Hono application..."
pnpm $PNPM_NO_DEP_CHECK --filter @pinsquirrel/hono start
