import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'apps/hono/vitest.config.ts',
  'libs/adapters/vitest.config.ts',
  'libs/database/vitest.config.ts',
  'libs/domain/vitest.config.ts',
  'libs/services/vitest.config.ts',
])
