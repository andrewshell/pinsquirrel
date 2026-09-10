/**
 * The options page's entry point, and nothing else.
 *
 * All it does is hand `initOptions` the four things it cannot do itself - ask
 * the worker to connect, revoke a grant, talk to `/api/v1`, ask the worker to
 * sync - so that the wiring in `options/init.ts` can be driven by a test with
 * none of them. Keeping the entry point this thin is what lets the tests
 * import the wiring without waking a service worker on import.
 *
 * `connect` is deliberately not among them: it opens a window, and when this
 * page was the action popup Chrome destroyed it the moment that window took
 * focus. The flow has run in the service worker ever since, which is still
 * where it belongs - a flow that outlives the page that asked for it.
 */
import { PinSquirrelApiClient } from './api-client.ts'
import { authorizedFetch, disconnect } from './auth.ts'
import { requestConnect, requestSync } from './messages.ts'
import { initOptions } from './options/init.ts'

void initOptions({
  document,
  requestConnect,
  disconnect,
  createApiClient: baseUrl =>
    new PinSquirrelApiClient({ baseUrl, fetch: authorizedFetch }),
  requestSync,
  now: () => Date.now(),
})
