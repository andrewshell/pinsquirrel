import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  noExternal: [
    '@pinsquirrel/adapters',
    '@pinsquirrel/database',
    '@pinsquirrel/domain',
    '@pinsquirrel/mailgun',
    '@pinsquirrel/services',
  ],
})
