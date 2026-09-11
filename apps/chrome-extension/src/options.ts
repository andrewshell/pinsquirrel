/**
 * The options page's entry point, and nothing else.
 *
 * All it does is hand `initOptions` the four things it cannot do itself - ask
 * the worker to connect, revoke a grant, talk to `/api/v1`, ask the worker to
 * sync - so that the wiring in `options/init.ts` can be driven by a test with
 * none of them. Keeping the entry point this thin is what lets the tests
 * import the wiring without waking a service worker on import.
 *
 * The OAuth flow is deliberately not among them: it ends in a tab the worker
 * watches, and the answer can come after this page is gone. It runs in the
 * service worker, which is where a flow that outlives the page that asked for
 * it belongs.
 */
import { PinSquirrelApiClient } from './api-client.ts'
import { authorizedFetch, disconnect } from './auth.ts'
import { onConnectFinished, requestConnect, requestSync } from './messages.ts'
import { initOptions } from './options/init.ts'

void initOptions({
  document,
  requestConnect,
  onConnectFinished,
  disconnect,
  createApiClient: baseUrl =>
    new PinSquirrelApiClient({ baseUrl, fetch: authorizedFetch }),
  requestSync,
  now: () => Date.now(),
})
