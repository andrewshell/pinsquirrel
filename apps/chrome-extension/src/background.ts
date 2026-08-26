/**
 * The service worker's entry point, and nothing else.
 *
 * All it does is hand `initBackground` the two things it cannot do itself -
 * a real sync over the stored connection, and somewhere to put a failure
 * nobody is waiting for - so that the wiring in `background/init.ts` can be
 * driven by a test with neither.
 *
 * The listeners are registered as this module is evaluated, which is the only
 * moment MV3 offers: the worker is torn down between events and this file runs
 * again to deliver the next one, so a listener registered after an `await`
 * would miss the event that woke the worker up.
 */
import { initBackground } from './background/init.ts'
import { runSync } from './bookmark-sync.ts'

initBackground({
  runSync,
  logger: {
    warn: message => {
      console.warn(message)
    },
  },
})
