/**
 * A write lost to concurrent writes on the same rows, or waited too long
 * behind them, and was undone in full. Nothing changed, and the same call
 * can succeed if it is made again.
 */
export class WriteConflictError extends Error {
  constructor(options?: ErrorOptions) {
    super('The write conflicted with another and changed nothing', options)
    this.name = 'WriteConflictError'
  }
}
