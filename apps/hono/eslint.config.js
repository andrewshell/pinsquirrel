import { createConfig } from '../../eslint.config.base.js'

export default [
  ...createConfig(import.meta.dirname),
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'src/static/**'] },
]
