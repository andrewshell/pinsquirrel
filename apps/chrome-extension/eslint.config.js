import { createConfig } from '../../eslint.config.base.js'

export default [
  ...createConfig(import.meta.dirname),
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  {
    // The build script reports progress on stdout; it has no logger.
    files: ['scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
]
