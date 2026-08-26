/**
 * The popup's entry point, and nothing else.
 *
 * All it does is hand `initPopup` the four things it cannot do itself - open a
 * consent tab, revoke a grant, talk to `/api/v1`, wake the service worker - so
 * that the wiring in `popup/init.ts` can be driven by a test with none of them.
 * Keeping the entry point this thin is what lets the tests import the wiring
 * without launching a browser flow on import.
 */
import { PinSquirrelApiClient } from './api-client.ts'
import { authorizedFetch, connect, disconnect } from './auth.ts'
import { requestSync } from './messages.ts'
import { initPopup } from './popup/init.ts'

void initPopup({
  document,
  connect,
  disconnect,
  createApiClient: baseUrl =>
    new PinSquirrelApiClient({ baseUrl, fetch: authorizedFetch }),
  requestSync,
  now: () => Date.now(),
})
