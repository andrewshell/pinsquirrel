FROM node:22-alpine AS development-dependencies-env
# Install pnpm
RUN corepack enable
COPY package.json pnpm-lock.yaml /app/
WORKDIR /app
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS production-dependencies-env
# Install pnpm
RUN corepack enable
COPY package.json pnpm-lock.yaml /app/
WORKDIR /app
RUN pnpm install --frozen-lockfile --prod

FROM node:22-alpine AS build-env
# Install pnpm
RUN corepack enable
COPY package.json pnpm-lock.yaml /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
COPY . /app/
WORKDIR /app
RUN pnpm run build

FROM node:22-alpine
# Install pnpm
RUN corepack enable

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S pinsquirrel -u 1001

# Copy package files
COPY package.json pnpm-lock.yaml /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build

# Copy database migrations and schema
COPY app/db /app/app/db
COPY drizzle.config.ts /app/

# Change ownership to non-root user
RUN chown -R pinsquirrel:nodejs /app

# Switch to non-root user
USER pinsquirrel

WORKDIR /app

# Run database migrations on startup
CMD ["sh", "-c", "pnpm drizzle-kit migrate && pnpm start"]