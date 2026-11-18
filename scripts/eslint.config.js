import { createConfig } from '../eslint.config.base.js'

export default [
  ...createConfig(import.meta.dirname),
  { ignores: ['node_modules/**', 'mysql-init/**'] },
  {
    files: ['release.ts'],
    rules: { 'no-console': 'off' },
  },
]
