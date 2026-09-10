/**
 * The popup's entry point, and nothing else.
 *
 * All it does is hand `initPopup` the four things it cannot do itself - ask
 * the worker to connect, revoke a grant, talk to `/api/v1`, ask the worker to
 * sync - so that the wiring in `popup/init.ts` can be driven by a test with
 * none of them. Keeping the entry point this thin is what lets the tests
 * import the wiring without waking a service worker on import.
 *
 * `connect` is deliberately not among them: it opens a window, and Chrome
 * destroys this popup the moment that window takes focus, so the flow runs in
 * the service worker and the popup only asks for it.
 */
import { PinSquirrelApiClient } from './api-client.ts'
import { authorizedFetch, disconnect } from './auth.ts'
import { requestConnect, requestSync } from './messages.ts'
import { initPopup } from './popup/init.ts'

void initPopup({
  document,
  requestConnect,
  disconnect,
  createApiClient: baseUrl =>
    new PinSquirrelApiClient({ baseUrl, fetch: authorizedFetch }),
  requestSync,
  now: () => Date.now(),
})
