/**
 * The database the app's tests run against.
 *
 * Deliberately not the development database. `vitest.config.ts` pins
 * `DATABASE_URL` to this value for every test in this package, so a developer
 * with a real `DATABASE_URL` exported in their shell cannot have a test run
 * write to it.
 *
 * It lives in a module of its own, importing nothing, because the vitest
 * config imports it: a config file is loaded by Node rather than by vitest's
 * transform pipeline, so anything reachable from here must resolve without it.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'mysql://pinsquirrel:pinsquirrel@localhost:3306/pinsquirrel_test'
