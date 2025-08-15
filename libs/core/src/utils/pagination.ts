export interface PaginationOptions {
  page?: number
  pageSize?: number
  defaultPageSize?: number
  maxPageSize?: number
}

export interface PaginationResult {
  page: number
  pageSize: number
  offset: number
  totalPages: number
  hasNext: boolean
  hasPrevious: boolean
}

export interface PaginatedData<T> {
  items: T[]
  pagination: PaginationResult
  totalCount: number
}

/**
 * Calculate pagination parameters from options and total count
 */
export function calculatePagination(
  totalCount: number,
  options: PaginationOptions = {}
): PaginationResult {
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

  return {
    page: normalizedPage,
    pageSize: normalizedPageSize,
    offset,
    totalPages,
    hasNext,
    hasPrevious,
  }
}

/**
 * Create a paginated data response
 */
export function createPaginatedResponse<T>(
  items: T[],
  totalCount: number,
  options: PaginationOptions = {}
): PaginatedData<T> {
  const pagination = calculatePagination(totalCount, options)

  return {
    items,
    pagination,
    totalCount,
  }
}

/**
 * Parse pagination parameters from query string or form data
 */
export function parsePaginationParams(
  params: Record<string, string | undefined>
): PaginationOptions {
  const page = params.page ? Math.max(1, Number(params.page) || 1) : 1
  const pageSize = params.pageSize
    ? Number(params.pageSize) || undefined
    : undefined

  return {
    page,
    pageSize,
  }
}
