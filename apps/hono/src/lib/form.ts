/**
 * Helpers for reading Hono's `parseBody()` output.
 *
 * `parseBody()` returns `string | File` per field: a file input yields a File
 * and an absent field yields undefined. Repeated keys do **not** produce an
 * array unless it is called with `{ all: true }` — the last value wins. What
 * matters to handlers is that the value is not necessarily a string: casting it
 * to one lets a multipart File through as a truthy non-string, which then
 * explodes on the first `.toLowerCase()` downstream.
 */

/** Anything `c.req.parseBody()` can produce for a single field. */
export type FormValue = unknown

/** A parsed form body, as returned by `c.req.parseBody()`. */
export type FormBody = Record<string, FormValue>

/**
 * Coerce one parsed form field to a string.
 *
 * Files, numbers, and missing fields become `''` rather than being
 * stringified. Arrays collapse to their first entry — `parseBody()` only
 * produces one under `{ all: true }`, which nothing here uses, but the shape is
 * handled rather than cast away.
 */
export function getString(value: FormValue): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return getString(value[0])
  return ''
}

/**
 * Protocol parameters as they arrived, from `parseBody({ all: true })` or
 * `c.req.queries()`: one string for a parameter sent once, every string for
 * one sent more than once. OAuth refuses a repeated parameter (RFC 6749 3.1),
 * which it can only do if the repeat survives parsing. Files and empty values
 * are dropped, so a schema sees them as missing.
 */
export function protocolParams(
  source: Record<string, unknown>
): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {}
  for (const [name, value] of Object.entries(source)) {
    const values = [value]
      .flat()
      .filter((one): one is string => typeof one === 'string' && one !== '')
    if (values.length === 1) params[name] = values[0]
    else if (values.length > 1) params[name] = values
  }
  return params
}

/** Split a comma-separated tag input, trimming blanks. */
export function parseTagNames(input: string): string[] {
  return input
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0)
}

export interface PinFormFields {
  url: string
  title: string
  /** `null` rather than `''` so it maps straight onto the nullable column. */
  description: string | null
  readLater: boolean
  isPrivate: boolean
  /** The raw input, kept for re-rendering the form after a failed submit. */
  tagsInput: string
  tagNames: string[]
}

/**
 * Read the pin create/edit form.
 *
 * `isPrivate` is reported as submitted. Routes that force it — the private
 * create form always stores a private pin — override it at the call site, so
 * that decision stays visible where it is made rather than hidden in here.
 */
export function parsePinForm(formData: FormBody): PinFormFields {
  const tagsInput = getString(formData.tags)

  return {
    url: getString(formData.url),
    title: getString(formData.title),
    description: getString(formData.description) || null,
    readLater: getString(formData.readLater) === 'true',
    isPrivate: getString(formData.isPrivate) === 'true',
    tagsInput,
    tagNames: parseTagNames(tagsInput),
  }
}
