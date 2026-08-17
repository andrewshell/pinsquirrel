/**
 * Helpers for reading Hono's `parseBody()` output.
 *
 * `parseBody()` returns `string | File | (string | File)[]` per field: a repeated
 * input yields an array, a file input yields a File, and an absent field yields
 * undefined. Handlers want a plain string, so every one of them used to declare
 * its own coercion inline.
 */

/** Anything `c.req.parseBody()` can produce for a single field. */
export type FormValue = unknown

/** A parsed form body, as returned by `c.req.parseBody()`. */
export type FormBody = Record<string, FormValue>

/**
 * Coerce one parsed form field to a string.
 *
 * Repeated fields collapse to their first entry; files, numbers, and missing
 * fields become `''` rather than being stringified.
 */
export function getString(value: FormValue): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return getString(value[0])
  return ''
}

/** Split a comma-separated tag input, trimming blanks. */
export function parseTagNames(input: string): string[] {
  return input
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
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
