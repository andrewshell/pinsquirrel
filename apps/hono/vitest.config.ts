import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Vitest publishes Vite's `base` option as `process.env.BASE_URL`, which
    // defaults to '/' and collides with our own BASE_URL env (the OAuth
    // issuer). Pin it to the dev default so importing `lib/config.ts` in a
    // test sees a real absolute URI instead of Vite's path.
    env: {
      BASE_URL: 'http://localhost:8100',
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
