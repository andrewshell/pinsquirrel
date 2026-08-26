import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  noExternal: [
    '@pinsquirrel/adapters',
    '@pinsquirrel/crypto',
    '@pinsquirrel/database',
    '@pinsquirrel/domain',
    '@pinsquirrel/mailgun',
    '@pinsquirrel/services',
  ],
  // Every third-party runtime dependency of the workspace packages bundled
  // above. Anything listed here stays a bare import in dist/index.js and is
  // resolved from apps/hono/node_modules at runtime, so each package must
  // also be a direct dependency of this app even if no source file imports
  // it. Leaving one out bundles it instead, which breaks CommonJS packages
  // (mysql2's `require('buffer')` becomes an unsupported dynamic require).
  external: [
    '@modelcontextprotocol/sdk',
    'cheerio',
    'drizzle-orm',
    'mailgun.js',
    'mysql2',
    'pino',
    'undici',
    'zod',
  ],
})
