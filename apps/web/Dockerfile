# Build context should be the monorepo root
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# Copy package files for dependency installation
FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY libs/core/package.json ./libs/core/
COPY libs/database/package.json ./libs/database/
RUN pnpm install --frozen-lockfile

# Build shared libraries
FROM dependencies AS libs-build
COPY libs/ ./libs/
COPY turbo.json ./
RUN pnpm build --filter="./libs/*"

# Build web application
FROM libs-build AS web-build
COPY apps/web/ ./apps/web/
RUN pnpm build --filter="@pinsquirrel/web"

# Production dependencies only
FROM base AS production-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY libs/core/package.json ./libs/core/
COPY libs/database/package.json ./libs/database/
RUN pnpm install --frozen-lockfile --prod

# Final runtime image
FROM node:22-alpine AS runtime
RUN corepack enable
WORKDIR /app

# Copy production dependencies
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=production-deps /app/apps/web/node_modules ./apps/web/node_modules

# Copy built application and required files
COPY --from=web-build /app/apps/web/build ./apps/web/build
COPY --from=libs-build /app/libs/core/dist ./libs/core/dist
COPY --from=libs-build /app/libs/database/dist ./libs/database/dist
COPY apps/web/package.json ./apps/web/
COPY package.json pnpm-workspace.yaml ./

WORKDIR /app/apps/web
EXPOSE 3000

CMD ["pnpm", "start"]