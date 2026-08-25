/**
 * The page size every list falls back to, and the ceiling a caller may ask
 * for.
 *
 * Both numbers were written out separately in the pagination defaults, in
 * `PinService.getUserPinsWithPagination`, in the API/MCP input schema's `max`
 * and its description, and in the HTML pin list — five places that had to be
 * changed together and no way to notice when they were not.
 */
export const DEFAULT_PAGE_SIZE = 25
export const MAX_PAGE_SIZE = 100

export interface PaginationOptions {
  page?: number
  pageSize?: number
  defaultPageSize?: number
  maxPageSize?: number
}

export class Pagination {
  readonly totalCount: number
  readonly page: number
  readonly pageSize: number
  readonly offset: number
  readonly totalPages: number
  readonly hasNext: boolean
  readonly hasPrevious: boolean

  constructor(
    totalCount: number,
    page: number,
    pageSize: number,
    offset: number,
    totalPages: number,
    hasNext: boolean,
    hasPrevious: boolean
  ) {
    this.totalCount = totalCount
    this.page = page
    this.pageSize = pageSize
    this.offset = offset
    this.totalPages = totalPages
    this.hasNext = hasNext
    this.hasPrevious = hasPrevious
  }

  static fromTotalCount(
    totalCount: number,
    options: PaginationOptions = {}
  ): Pagination {
    const {
      page = 1,
      pageSize = options.defaultPageSize ?? DEFAULT_PAGE_SIZE,
      maxPageSize = MAX_PAGE_SIZE,
    } = options

    // Ensure page is at least 1
    const normalizedPage = Math.max(1, page)

    // Ensure pageSize is within reasonable bounds
    const normalizedPageSize = Math.min(Math.max(1, pageSize), maxPageSize)

    // Calculate offset for database queries
    const offset = (normalizedPage - 1) * normalizedPageSize

    // Calculate total pages
    const totalPages = Math.max(1, Math.ceil(totalCount / normalizedPageSize))

    // Calculate navigation flags
    const hasNext = normalizedPage < totalPages
    const hasPrevious = normalizedPage > 1

    return new Pagination(
      totalCount,
      normalizedPage,
      normalizedPageSize,
      offset,
      totalPages,
      hasNext,
      hasPrevious
    )
  }
}
