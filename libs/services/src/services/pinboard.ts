import type { AccessControl, Pin } from '@pinsquirrel/domain'
import { DuplicatePinError } from '@pinsquirrel/domain'
import { md5 } from '../utils/crypto.js'
import type { PinService } from './pin.js'

/** One entry of a Pinboard JSON export. */
export interface PinboardPin {
  href: string
  description: string
  extended: string
  meta: string
  hash: string
  time: string
  shared: string
  toread: string
  tags: string
}

export type InvalidPinboardExportReason =
  /** The file is not JSON at all. */
  | 'malformed-json'
  /** Valid JSON, but not a non-empty array. */
  | 'not-a-list'
  /** An array, but the first entry lacks the fields a Pinboard export has. */
  | 'wrong-shape'

export class InvalidPinboardExportError extends Error {
  constructor(readonly reason: InvalidPinboardExportReason) {
    super(`Not a valid Pinboard export: ${reason}`)
    this.name = 'InvalidPinboardExportError'
  }
}

export interface ImportResult {
  imported: number
  /** Pins already present, counted whether or not their date was corrected. */
  skipped: number
  /** Every distinct tag seen across the file, including on skipped pins. */
  tagNames: Set<string>
}

/** Pinboard caps these; longer values are cut rather than rejected. */
const MAX_TITLE = 200
const MAX_DESCRIPTION = 1000

/** Pinboard's `time` has no milliseconds. */
function formatPinboardTime(date: Date): string {
  return date.toISOString().replace('.000Z', 'Z')
}

/**
 * Reading and writing the Pinboard JSON export format.
 *
 * The format's rules live here rather than in a route handler: the field
 * mapping, the truncation limits, the reconciliation rule for a URL the user
 * already has, and the `hash`/`meta` digests that make an export readable by
 * Pinboard-compatible tools.
 */
export class PinboardService {
  constructor(private readonly pinService: PinService) {}

  /**
   * Parse the text of an export file.
   *
   * Only the first entry is inspected. A file whose later rows are malformed
   * still imports — those rows fail individually in `importPins` and are
   * skipped, which is preferable to rejecting a large export outright.
   */
  static parse(text: string): PinboardPin[] {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new InvalidPinboardExportError('malformed-json')
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new InvalidPinboardExportError('not-a-list')
    }

    const first = parsed[0] as Partial<PinboardPin>
    if (!first.href || !first.description || !first.time) {
      throw new InvalidPinboardExportError('wrong-shape')
    }

    return parsed as PinboardPin[]
  }

  /**
   * Create a pin for each entry.
   *
   * A single bad entry never aborts the run: a URL the user already has is
   * counted as skipped, and any other failure is reported through `onPinError`
   * and passed over. `shared` is ignored — imported pins all land in the main
   * list, and privacy is managed in PinSquirrel rather than inherited.
   */
  async importPins(
    ac: AccessControl,
    userId: string,
    pins: PinboardPin[],
    onPinError?: (error: unknown, pin: PinboardPin) => void
  ): Promise<ImportResult> {
    let imported = 0
    let skipped = 0
    const tagNames = new Set<string>()

    for (const pin of pins) {
      const createdAt = new Date(pin.time)
      const tags = PinboardService.parseTags(pin.tags)
      tags.forEach(tag => tagNames.add(tag))

      try {
        await this.pinService.createPin(ac, {
          userId,
          url: pin.href,
          title: PinboardService.titleFor(pin),
          description: PinboardService.descriptionFor(pin),
          readLater: pin.toread === 'yes',
          isPrivate: false,
          tagNames: tags,
          createdAt,
          updatedAt: createdAt,
        })
        imported++
      } catch (error) {
        if (!(error instanceof DuplicatePinError)) {
          onPinError?.(error, pin)
          continue
        }

        // The user already has this URL. Keep the earlier of the two dates so
        // a pin saved here later than it was bookmarked on Pinboard does not
        // jump to the top of the list. Best-effort: a failure to correct the
        // date must not stop the rest of the import.
        if (error.existingPin && createdAt < error.existingPin.createdAt) {
          try {
            await this.pinService.backdatePin(
              ac,
              error.existingPin.id,
              createdAt
            )
          } catch (backdateError) {
            onPinError?.(backdateError, pin)
          }
        }
        skipped++
      }
    }

    return { imported, skipped, tagNames }
  }

  /**
   * Every pin the user can share, in Pinboard's shape.
   *
   * Private pins are left out: an export is a file that leaves the system, and
   * nothing downstream would preserve the distinction.
   */
  async exportPins(ac: AccessControl): Promise<PinboardPin[]> {
    const pins = await this.pinService.getUserPins(ac)
    return pins
      .filter(pin => !pin.isPrivate)
      .map(pin => PinboardService.toPinboardPin(pin))
  }

  static toPinboardPin(pin: Pin): PinboardPin {
    const tags = pin.tagNames.join(' ')
    const toread = pin.readLater ? 'yes' : 'no'
    return {
      href: pin.url,
      description: pin.title,
      extended: pin.description ?? '',
      meta: md5(
        [pin.url, pin.title, pin.description ?? '', tags, toread].join('\n')
      ),
      hash: md5(pin.url),
      time: formatPinboardTime(pin.createdAt),
      // PinSquirrel has no per-pin shared flag, so every row reports 'no'.
      shared: 'no',
      toread,
      tags,
    }
  }

  /** Pinboard separates tags with spaces, not commas. */
  private static parseTags(tags: string): string[] {
    return tags
      .split(' ')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
  }

  /** A blank title falls back to the URL, so no pin imports unlabelled. */
  private static titleFor(pin: PinboardPin): string {
    const title = pin.description?.trim() || pin.href
    return title.length > MAX_TITLE ? title.substring(0, MAX_TITLE) : title
  }

  private static descriptionFor(pin: PinboardPin): string | null {
    const description = pin.extended || null
    if (description && description.length > MAX_DESCRIPTION) {
      return description.substring(0, MAX_DESCRIPTION)
    }
    return description
  }
}
