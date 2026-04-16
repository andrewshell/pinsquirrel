import { z } from 'zod'

/**
 * Preprocessor that coerces string query-param values to booleans.
 *
 * Accepts `"true"` / `"1"` → `true`, `"false"` / `"0"` → `false`,
 * or a native boolean passthrough.
 *
 * `z.coerce.boolean()` cannot be used because `Boolean("false")` is `true`.
 */
function coerceBooleanString(val: unknown): unknown {
  if (val === 'true' || val === '1') return true
  if (val === 'false' || val === '0') return false
  return val
}

export const booleanFromString = z.preprocess(coerceBooleanString, z.boolean())

/**
 * Zod schema that coerces a string query-param value to a number.
 * Uses z.coerce.number() which handles string-to-number conversion.
 */
export const numberFromString = z.coerce.number()
