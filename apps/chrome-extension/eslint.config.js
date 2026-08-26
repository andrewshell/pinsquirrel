import { createConfig } from '../../eslint.config.base.js'

export default [
  ...createConfig(import.meta.dirname),
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  {
    // The build script reports progress on stdout; it has no logger.
    files: ['scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    // A service worker's only output is the DevTools console, so the entry
    // point is where `console` is named - `initBackground` takes a logger.
    files: ['src/background.ts'],
    rules: { 'no-console': 'off' },
  },
]
