# syntax=docker/dockerfile:1.7-labs
# Build context should be the monorepo root
FROM node:26.13.1-alpine AS base
RUN npm install -g corepack@0.36.0 && corepack enable
WORKDIR /app

# Copy package files for dependency installation
FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# --parents keeps each manifest at its workspace path, so a new package
# under libs/ needs no edit here.
COPY --parents apps/hono/package.json libs/*/package.json ./
RUN pnpm install --frozen-lockfile

# Build hono application (Turbo will build dependencies automatically)
FROM dependencies AS hono-build
COPY apps/hono/ ./apps/hono/
COPY libs/ ./libs/
COPY turbo.json ./
# Build the app and CSS
RUN pnpm build --filter="@pinsquirrel/hono"
RUN pnpm --filter @pinsquirrel/hono css:build

# Production dependencies only
FROM base AS production-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# --parents keeps each manifest at its workspace path, so a new package
# under libs/ needs no edit here.
COPY --parents apps/hono/package.json libs/*/package.json ./
RUN npm_config_ignore_scripts=true pnpm install --frozen-lockfile --prod

# Final runtime image
FROM node:26.13.1-alpine AS runtime
LABEL org.opencontainers.image.source="https://github.com/andrewshell/pinsquirrel"
RUN npm install -g corepack@0.36.0 && corepack enable
WORKDIR /app

# Copy production dependencies
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=production-deps /app/apps/hono/node_modules ./apps/hono/node_modules
COPY --from=production-deps /app/libs/adapters/node_modules ./libs/adapters/node_modules
COPY --from=production-deps /app/libs/database/node_modules ./libs/database/node_modules
COPY --from=production-deps /app/libs/mailgun/node_modules ./libs/mailgun/node_modules

# Copy built application
COPY --from=hono-build /app/apps/hono/dist ./apps/hono/dist
COPY --from=hono-build /app/apps/hono/package.json ./apps/hono/package.json

# Copy static files (CSS, JS, images)
COPY --from=hono-build /app/apps/hono/src/static ./apps/hono/src/static

# Copy workspace structure
COPY --from=production-deps /app/package.json ./package.json
COPY --from=production-deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Fetch the pnpm that package.json's packageManager names at build time, so a
# container start needs no registry. The cache sits outside root's home so a
# container run with --user can read it, and with the network off for
# Corepack a missing cache fails at once instead of downloading.
ENV COREPACK_HOME=/opt/corepack
RUN corepack install && chmod -R a+rX /opt/corepack
ENV COREPACK_ENABLE_NETWORK=0

# Copy database package for migrations
COPY --from=hono-build /app/libs/database/package.json ./libs/database/package.json
COPY --from=hono-build /app/libs/database/src/migrations ./libs/database/src/migrations
COPY --from=hono-build /app/libs/database/drizzle.config.ts ./libs/database/drizzle.config.ts

# Copy migration script
COPY --from=hono-build /app/apps/hono/migrate-and-start.sh ./apps/hono/migrate-and-start.sh
RUN chmod +x ./apps/hono/migrate-and-start.sh

# Default port (matches development port)
ENV PORT=8100
EXPOSE 8100

CMD ["./apps/hono/migrate-and-start.sh"]
