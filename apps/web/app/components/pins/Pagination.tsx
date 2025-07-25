import { Link } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '~/components/ui/button'

interface PaginationProps {
  currentPage: number
  totalPages: number
  totalCount: number
}

export function Pagination({ currentPage, totalPages, totalCount }: PaginationProps) {
  // Don't render pagination if there's only one page or no items
  if (totalPages <= 1 || totalCount === 0) {
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
    <nav
      role="navigation"
      aria-label="Pagination navigation"
      className="flex items-center justify-between px-4 py-3 sm:px-6"
    >
      {/* Mobile pagination info */}
      <div className="flex flex-1 justify-between sm:hidden">
        <div className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </div>
        <div className="text-sm text-muted-foreground">
          {totalCount === 1 ? '1 total pin' : `${totalCount} total pins`}
        </div>
      </div>

      {/* Desktop pagination */}
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages} ({totalCount === 1 ? '1 total pin' : `${totalCount} total pins`})
        </div>
        
        <div className="flex items-center space-x-1">
          {/* Previous button */}
          <Button
            variant="ghost"
            size="sm"
            asChild={!isFirstPage}
            disabled={isFirstPage}
            aria-label="Go to previous page"
            aria-disabled={isFirstPage}
            className={isFirstPage ? 'pointer-events-none opacity-50' : ''}
          >
            {isFirstPage ? (
              <span>
                <ChevronLeft className="h-4 w-4" />
                Previous
              </span>
            ) : (
              <Link to={`/pins?page=${currentPage - 1}`}>
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Link>
            )}
          </Button>

          {/* Page numbers */}
          <div className="hidden sm:flex items-center space-x-1">
            {pageNumbers.map((page, index) => {
              if (page === 'ellipsis') {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="px-2 py-1 text-sm text-muted-foreground"
                  >
                    …
                  </span>
                )
              }

              const isCurrentPage = page === currentPage

              return isCurrentPage ? (
                <span
                  key={page}
                  aria-current="page"
                  className="px-3 py-1 text-sm font-medium bg-primary text-primary-foreground rounded-md"
                >
                  {page}
                </span>
              ) : (
                <Button
                  key={page}
                  variant="ghost"
                  size="sm"
                  asChild
                  aria-label={`Go to page ${page}`}
                >
                  <Link to={`/pins?page=${page}`}>
                    {page}
                  </Link>
                </Button>
              )
            })}
          </div>

          {/* Next button */}
          <Button
            variant="ghost"
            size="sm"
            asChild={!isLastPage}
            disabled={isLastPage}
            aria-label="Go to next page"
            aria-disabled={isLastPage}
            className={isLastPage ? 'pointer-events-none opacity-50' : ''}
          >
            {isLastPage ? (
              <span>
                Next
                <ChevronRight className="h-4 w-4" />
              </span>
            ) : (
              <Link to={`/pins?page=${currentPage + 1}`}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </Button>
        </div>
      </div>

      {/* Mobile navigation buttons */}
      <div className="flex sm:hidden space-x-2">
        <Button
          variant="ghost"
          size="sm"
          asChild={!isFirstPage}
          disabled={isFirstPage}
          aria-label="Go to previous page (mobile)"
          className={isFirstPage ? 'pointer-events-none opacity-50' : ''}
        >
          {isFirstPage ? (
            <span>
              <ChevronLeft className="h-4 w-4" />
            </span>
          ) : (
            <Link to={`/pins?page=${currentPage - 1}`}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          asChild={!isLastPage}
          disabled={isLastPage}
          aria-label="Go to next page (mobile)"
          className={isLastPage ? 'pointer-events-none opacity-50' : ''}
        >
          {isLastPage ? (
            <span>
              <ChevronRight className="h-4 w-4" />
            </span>
          ) : (
            <Link to={`/pins?page=${currentPage + 1}`}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </Button>
      </div>
    </nav>
  )
}