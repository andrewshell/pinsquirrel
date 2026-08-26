import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The real `popup.html`, parsed into a document a test can drive.
 *
 * Loaded from disk rather than restated as a fixture string on purpose: the
 * popup's code finds its elements by id, and a fixture would let the markup and
 * the code drift apart without a single test noticing.
 *
 * Requires the `happy-dom` environment for `DOMParser`. The path is joined
 * rather than resolved through a `URL`, because in that environment `URL` is
 * happy-dom's and `readFileSync` will not take one.
 */
const html = readFileSync(
  join(import.meta.dirname, '..', '..', 'popup.html'),
  'utf8'
)

export function loadPopupDocument(): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}
