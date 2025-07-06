# @pinsquirrel/api

A modern TypeScript API built with Hono, designed for type-safe client consumption.

## Features

- 🚀 **Hono Framework** - Ultra-fast web framework
- 🛡️ **Type Safety** - Full TypeScript support with client type generation
- 🔍 **Validation** - Zod-based request validation
- 🔒 **Security** - CORS, rate limiting, and security headers
- 📝 **Logging** - Structured logging with Pino
- 🧪 **Testing** - Vitest for unit and integration tests
- 🔧 **Development** - Hot reloading with Vite

## Development

From the monorepo root:

```bash
# Start development server
pnpm --filter api dev

# Run tests
pnpm --filter api test

# Run tests with watch mode and coverage
pnpm --filter api test:watch

# Run linting
pnpm --filter api lint

# Format code
pnpm --filter api format

# Type check
pnpm --filter api typecheck
```

## API Endpoints

### Health Checks
- `GET /health` - Basic health check
- `GET /health/ready` - Readiness check

### API v1
- `GET /api/v1/users/:id` - Get user by ID
- `POST /api/v1/users` - Create new user

## Client Usage

This API is designed to be consumed by `hono/client`:

```typescript
import { hc } from 'hono/client'
import type { AppType } from '@pinsquirrel/api'

const client = hc<AppType>('http://localhost:8101')

// Type-safe API calls
const response = await client.api.v1.users.$post({
  json: {
    name: 'John Doe',
    email: 'john@example.com'
  }
})

const user = await response.json()
```

## Environment Variables

```env
NODE_ENV=development
PORT=8101
LOG_LEVEL=info
```

## Project Structure

```
src/
├── app.ts              # Main application setup
├── server.ts           # Production server entry
├── middleware/         # Custom middleware
│   ├── error.ts       # Error handling
│   ├── logger.ts      # Request logging
│   └── security.ts    # Security middleware
└── routes/            # API routes
    ├── api.ts         # API v1 routes
    └── health.ts      # Health check routes
```

## Build & Deploy

```bash
# Build for production
pnpm --filter api build

# Start production server
pnpm --filter api start
```

The build process generates:
- `dist/app.js` - Main application (for client imports)
- `dist/server.js` - Production server
- `dist/app.d.ts` - Type definitions