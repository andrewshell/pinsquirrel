export interface PaginationOptions {
  page?: number
  pageSize?: number
  defaultPageSize?: number
  maxPageSize?: number
}

export class Pagination {
  readonly page: number
  readonly pageSize: number
  readonly offset: number
  readonly totalPages: number
  readonly hasNext: boolean
  readonly hasPrevious: boolean

  constructor(
    page: number,
    pageSize: number,
    offset: number,
    totalPages: number,
    hasNext: boolean,
    hasPrevious: boolean
  ) {
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
      pageSize = options.defaultPageSize || 25,
      maxPageSize = 100,
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
      normalizedPage,
      normalizedPageSize,
      offset,
      totalPages,
      hasNext,
      hasPrevious
    )
  }
}
