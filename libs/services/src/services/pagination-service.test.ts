import { describe, it, expect } from 'vitest'
import { PaginationService } from './pagination-service.js'

describe('PaginationService', () => {
  describe('calculatePagination', () => {
    it('should calculate basic pagination with default values', () => {
      const result = PaginationService.calculatePagination(100)

      expect(result).toEqual({
        page: 1,
        pageSize: 25,
        offset: 0,
        totalPages: 4,
        hasNext: true,
        hasPrevious: false,
      })
    })

    it('should handle custom page and pageSize', () => {
      const result = PaginationService.calculatePagination(100, {
        page: 2,
        pageSize: 10,
      })

      expect(result).toEqual({
        page: 2,
        pageSize: 10,
        offset: 10,
        totalPages: 10,
        hasNext: true,
        hasPrevious: true,
      })
    })

    it('should enforce minimum page of 1', () => {
      const result = PaginationService.calculatePagination(100, { page: 0 })

      expect(result.page).toBe(1)
      expect(result.offset).toBe(0)
    })

    it('should enforce maximum pageSize', () => {
      const result = PaginationService.calculatePagination(100, {
        pageSize: 200,
        maxPageSize: 50,
      })

      expect(result.pageSize).toBe(50)
    })

    it('should handle edge case with 0 total count', () => {
      const result = PaginationService.calculatePagination(0)

      expect(result).toEqual({
        page: 1,
        pageSize: 25,
        offset: 0,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      })
    })

    it('should calculate last page correctly', () => {
      const result = PaginationService.calculatePagination(100, {
        page: 4,
        pageSize: 25,
      })

      expect(result).toEqual({
        page: 4,
        pageSize: 25,
        offset: 75,
        totalPages: 4,
        hasNext: false,
        hasPrevious: true,
      })
    })

    it('should handle page beyond total pages', () => {
      const result = PaginationService.calculatePagination(10, {
        page: 5,
        pageSize: 5,
      })

      expect(result).toEqual({
        page: 5,
        pageSize: 5,
        offset: 20,
        totalPages: 2,
        hasNext: false,
        hasPrevious: true,
      })
    })
  })

  describe('createPaginatedResponse', () => {
    it('should create a complete paginated response', () => {
      const items = ['item1', 'item2', 'item3']
      const result = PaginationService.createPaginatedResponse(items, 100, {
        page: 2,
        pageSize: 10,
      })

      expect(result).toEqual({
        items,
        totalCount: 100,
        pagination: {
          page: 2,
          pageSize: 10,
          offset: 10,
          totalPages: 10,
          hasNext: true,
          hasPrevious: true,
        },
      })
    })
  })

  describe('parsePaginationParams', () => {
    it('should parse valid pagination parameters', () => {
      const params = { page: '2', pageSize: '15' }
      const result = PaginationService.parsePaginationParams(params)

      expect(result).toEqual({
        page: 2,
        pageSize: 15,
      })
    })

    it('should handle missing parameters with defaults', () => {
      const params = {}
      const result = PaginationService.parsePaginationParams(params)

      expect(result).toEqual({
        page: 1,
        pageSize: undefined,
      })
    })

    it('should handle invalid page numbers', () => {
      const params = { page: 'invalid', pageSize: 'also-invalid' }
      const result = PaginationService.parsePaginationParams(params)

      expect(result).toEqual({
        page: 1,
        pageSize: undefined,
      })
    })

    it('should enforce minimum page of 1', () => {
      const params = { page: '0' }
      const result = PaginationService.parsePaginationParams(params)

      expect(result.page).toBe(1)
    })

    it('should handle negative page numbers', () => {
      const params = { page: '-5' }
      const result = PaginationService.parsePaginationParams(params)

      expect(result.page).toBe(1)
    })
  })
})
