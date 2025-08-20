import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Builds a URL with the specified page parameter while preserving all other search parameters
 */
export function buildPaginationUrl(
  searchParams: URLSearchParams,
  page: number
): string {
  const newParams = new URLSearchParams(searchParams)
  newParams.set('page', page.toString())
  return `?${newParams.toString()}`
}
