/// <reference types="vitest" />
import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  server: {
    port: 8100,
  },
  plugins: [
    tailwindcss(),
    !process.env.VITEST && reactRouter(),
    tsconfigPaths(),
  ],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './vitest.setup.ts',
    css: true,
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        '.react-router/**',
        'coverage/**',
        'dist/**',
        'build/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'vitest.setup.ts',
      ],
    },
  },
})
