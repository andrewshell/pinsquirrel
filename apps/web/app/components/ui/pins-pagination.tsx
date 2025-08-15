import { useEffect, useRef } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { buttonVariants } from '~/components/ui/button'
import { cn } from '~/lib/utils'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '~/components/ui/pagination'

interface PinsPaginationProps {
  currentPage: number
  totalPages: number
  totalCount: number
}

export function PinsPagination({
  currentPage,
  totalPages,
  totalCount,
}: PinsPaginationProps) {
  const paginationRef = useRef<HTMLElement>(null)
  const shouldRender = totalPages > 1 && totalCount > 0

  // Announce page changes to screen readers
  useEffect(() => {
    if (shouldRender && paginationRef.current) {
      // Create a live region announcement for page changes
      const announcement = `Page ${currentPage} of ${totalPages} loaded`
      const announcer = document.createElement('div')
      announcer.setAttribute('aria-live', 'polite')
      announcer.setAttribute('aria-atomic', 'true')
      announcer.className = 'sr-only'
      announcer.textContent = announcement

      document.body.appendChild(announcer)

      // Clean up after announcement
      setTimeout(() => {
        if (document.body.contains(announcer)) {
          document.body.removeChild(announcer)
        }
      }, 1000)
    }
  }, [currentPage, totalPages, shouldRender])

  // Don't render pagination if there's only one page or no items
  if (!shouldRender) {
    return null
  }

  const isFirstPage = currentPage === 1
  const isLastPage = currentPage === totalPages

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []

    if (totalPages <= 7) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)

      if (currentPage > 4) {
        pages.push('ellipsis')
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (currentPage < totalPages - 3) {
        pages.push('ellipsis')
      }

      // Always show last page (if not already included)
      if (totalPages > 1) {
        pages.push(totalPages)
      }
    }

    return pages
  }

  const pageNumbers = getPageNumbers()

  return (
    <div className="flex flex-col items-center gap-4 px-4 py-6 sm:px-6">
      {/* Pagination info */}
      <div className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages} (
        {totalCount === 1 ? '1 total pin' : `${totalCount} total pins`})
      </div>

      {/* Pagination controls */}
      <Pagination ref={paginationRef}>
        <PaginationContent>
          <PaginationItem>
            {isFirstPage ? (
              <span
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'default' }),
                  'gap-1 px-2.5 sm:pl-2.5 opacity-50 cursor-not-allowed'
                )}
              >
                <ChevronLeftIcon />
                <span className="hidden sm:block">Previous</span>
              </span>
            ) : (
              <PaginationPrevious to={`/pins?page=${currentPage - 1}`} />
            )}
          </PaginationItem>

          {pageNumbers.map((page, index) => (
            <PaginationItem
              key={page === 'ellipsis' ? `ellipsis-${index}` : page}
            >
              {page === 'ellipsis' ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink
                  to={`/pins?page=${page}`}
                  isActive={page === currentPage}
                >
                  {page}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}

          <PaginationItem>
            {isLastPage ? (
              <span
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'default' }),
                  'gap-1 px-2.5 sm:pr-2.5 opacity-50 cursor-not-allowed'
                )}
              >
                <span className="hidden sm:block">Next</span>
                <ChevronRightIcon />
              </span>
            ) : (
              <PaginationNext to={`/pins?page=${currentPage + 1}`} />
            )}
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
