# Build context should be the monorepo root
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# Copy package files for dependency installation
FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY libs/adapters/package.json ./libs/adapters/
COPY libs/database/package.json ./libs/database/
COPY libs/domain/package.json ./libs/domain/
COPY libs/mailgun/package.json ./libs/mailgun/
COPY libs/services/package.json ./libs/services/
RUN pnpm install --frozen-lockfile

# Build web application (Turbo will build dependencies automatically)
FROM dependencies AS web-build
COPY apps/web/ ./apps/web/
COPY libs/ ./libs/
COPY turbo.json ./
RUN pnpm build --filter="@pinsquirrel/web"

# Production dependencies only
FROM base AS production-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY libs/adapters/package.json ./libs/adapters/
COPY libs/database/package.json ./libs/database/
COPY libs/domain/package.json ./libs/domain/
COPY libs/mailgun/package.json ./libs/mailgun/
COPY libs/services/package.json ./libs/services/
RUN pnpm install --frozen-lockfile --prod

# Final runtime image
FROM node:22-alpine AS runtime
RUN corepack enable
WORKDIR /app

# Copy production dependencies
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=production-deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=production-deps /app/libs/database/node_modules ./libs/database/node_modules

# Copy built application and workspace structure
COPY --from=web-build /app/apps/web/build ./apps/web/build
COPY --from=web-build /app/apps/web/package.json ./apps/web/package.json
COPY --from=production-deps /app/package.json ./package.json
COPY --from=production-deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Copy database package for migrations
COPY --from=web-build /app/libs/database/package.json ./libs/database/package.json
COPY --from=web-build /app/libs/database/src/migrations ./libs/database/src/migrations
COPY --from=web-build /app/libs/database/drizzle.config.ts ./libs/database/drizzle.config.ts

# Copy migration script
COPY --from=web-build /app/apps/web/migrate-and-start.sh ./apps/web/migrate-and-start.sh
RUN chmod +x ./apps/web/migrate-and-start.sh

# Note: Workspace package code is bundled in the build output,
# so we don't need to copy dist folders from libs

# Default port for react-router-serve (override with PORT env variable)
# Development uses 8100 (vite), production defaults to 3000
ENV PORT=3000
EXPOSE 3000

CMD ["./apps/web/migrate-and-start.sh"]
