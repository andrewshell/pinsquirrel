import { defineConfig } from 'vitest/config'
import { TEST_DATABASE_URL } from './src/test-support/test-database-url.ts'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Creates the tables the end-to-end test needs. Additive; see the file.
    globalSetup: './src/test-support/database.ts',
    // Vitest publishes Vite's `base` option as `process.env.BASE_URL`, which
    // defaults to '/' and collides with our own BASE_URL env (the OAuth
    // issuer). Pin it to the dev default so importing `lib/config.ts` in a
    // test sees a real absolute URI instead of Vite's path.
    env: {
      BASE_URL: 'http://localhost:8100',
      // The app reads this at import, so a test cannot set it late. Pinned
      // rather than inherited so a `DATABASE_URL` exported in a developer's
      // shell can never be the one a test run writes to.
      DATABASE_URL: TEST_DATABASE_URL,
      // The end-to-end test drives the whole app, request logger included.
      LOG_LEVEL: 'silent',
    },
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'dist/**',
        'coverage/**',
        '**/*.d.ts',
        '**/*.config.*',
        'node_modules/**',
      ],
    },
  },
})
