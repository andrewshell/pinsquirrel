# Build context should be the monorepo root
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# Copy package files for dependency installation
FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/hono/package.json ./apps/hono/
COPY libs/adapters/package.json ./libs/adapters/
COPY libs/database/package.json ./libs/database/
COPY libs/domain/package.json ./libs/domain/
COPY libs/mailgun/package.json ./libs/mailgun/
COPY libs/services/package.json ./libs/services/
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
COPY apps/hono/package.json ./apps/hono/
COPY libs/adapters/package.json ./libs/adapters/
COPY libs/database/package.json ./libs/database/
COPY libs/domain/package.json ./libs/domain/
COPY libs/mailgun/package.json ./libs/mailgun/
COPY libs/services/package.json ./libs/services/
RUN npm_config_ignore_scripts=true pnpm install --frozen-lockfile --prod

# Final runtime image
FROM node:22-alpine AS runtime
RUN corepack enable
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
