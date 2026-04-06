import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      'apps/hono/vitest.config.ts',
      'libs/adapters/vitest.config.ts',
      'libs/database/vitest.config.ts',
      'libs/domain/vitest.config.ts',
      'libs/mailgun/vitest.config.ts',
      'libs/services/vitest.config.ts',
    ],
  },
})
