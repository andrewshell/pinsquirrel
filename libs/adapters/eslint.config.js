import { createConfig } from '../../eslint.config.base.js'

export default [
  // Strict: this package is the only place that talks to the network and to
  // third-party HTML, so the extra rules earn their keep here.
  ...createConfig(import.meta.dirname, { strict: true }),
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
]
