/**
 * The service worker's entry point, and nothing else.
 *
 * All it does is hand `initBackground` the three things it cannot do itself -
 * a real sync over the stored connection, a real OAuth flow, and somewhere to
 * put a failure nobody is waiting for - so that the wiring in
 * `background/init.ts` can be driven by a test with none of them.
 *
 * The listeners are registered as this module is evaluated, which is the only
 * moment MV3 offers: the worker is torn down between events and this file runs
 * again to deliver the next one, so a listener registered after an `await`
 * would miss the event that woke the worker up.
 */
import { connect } from './auth.ts'
import { initBackground } from './background/init.ts'
import { runSync } from './bookmark-sync.ts'

initBackground({
  runSync,
  connect,
  logger: {
    warn: message => {
      console.warn(message)
    },
  },
})
