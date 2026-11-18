import type {
  CreateEmailChangeData,
  EmailChange,
} from '../entities/email-change.js'

export interface EmailChangeRepository {
  /** Store the user's pending change, replacing any earlier one. */
  save(data: CreateEmailChangeData): Promise<void>
  /**
   * Delete the unexpired change with this token hash and return it. Of any
   * number of concurrent callers, only the one whose delete took it gets it.
   */
  consume(tokenHash: string): Promise<EmailChange | null>
}
