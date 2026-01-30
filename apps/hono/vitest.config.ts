import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
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
