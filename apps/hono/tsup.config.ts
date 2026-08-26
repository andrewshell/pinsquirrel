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
  // Anything listed here stays a bare import in dist/index.js and is
  // resolved from apps/hono/node_modules at runtime, so each package must
  // be a direct dependency of this app even if no source file imports it.
  external: ['cheerio', 'mailgun.js', 'pino'],
})
