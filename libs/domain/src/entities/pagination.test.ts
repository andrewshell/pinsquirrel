import { describe, it, expect } from 'vitest'
import { Pagination } from './pagination.js'

describe('Pagination', () => {
  describe('fromTotalCount', () => {
    it('should create pagination with default values', () => {
      const pagination = Pagination.fromTotalCount(100)

      expect(pagination.page).toBe(1)
      expect(pagination.pageSize).toBe(25)
      expect(pagination.offset).toBe(0)
      expect(pagination.totalPages).toBe(4)
      expect(pagination.hasNext).toBe(true)
      expect(pagination.hasPrevious).toBe(false)
    })

    it('should handle custom page and pageSize', () => {
      const pagination = Pagination.fromTotalCount(100, {
        page: 2,
        pageSize: 10,
      })

      expect(pagination.page).toBe(2)
      expect(pagination.pageSize).toBe(10)
      expect(pagination.offset).toBe(10)
      expect(pagination.totalPages).toBe(10)
      expect(pagination.hasNext).toBe(true)
      expect(pagination.hasPrevious).toBe(true)
    })

    it('should use defaultPageSize when pageSize not provided', () => {
      const pagination = Pagination.fromTotalCount(100, {
        defaultPageSize: 15,
      })

      expect(pagination.pageSize).toBe(15)
      expect(pagination.totalPages).toBe(7)
    })

    it('should enforce maxPageSize limit', () => {
      const pagination = Pagination.fromTotalCount(100, {
        pageSize: 200,
        maxPageSize: 50,
      })

      expect(pagination.pageSize).toBe(50)
      expect(pagination.totalPages).toBe(2)
    })

    it('should normalize page to minimum of 1', () => {
      const pagination = Pagination.fromTotalCount(100, {
        page: -5,
      })

      expect(pagination.page).toBe(1)
      expect(pagination.offset).toBe(0)
      expect(pagination.hasPrevious).toBe(false)
    })

    it('should normalize pageSize to minimum of 1', () => {
      const pagination = Pagination.fromTotalCount(100, {
        pageSize: -10,
      })

      expect(pagination.pageSize).toBe(1)
    })

    it('should handle zero total count', () => {
      const pagination = Pagination.fromTotalCount(0)

      expect(pagination.page).toBe(1)
      expect(pagination.pageSize).toBe(25)
      expect(pagination.offset).toBe(0)
      expect(pagination.totalPages).toBe(1)
      expect(pagination.hasNext).toBe(false)
      expect(pagination.hasPrevious).toBe(false)
    })

    it('should calculate correct navigation flags for first page', () => {
      const pagination = Pagination.fromTotalCount(100, {
        page: 1,
        pageSize: 25,
      })

      expect(pagination.hasNext).toBe(true)
      expect(pagination.hasPrevious).toBe(false)
    })

    it('should calculate correct navigation flags for middle page', () => {
      const pagination = Pagination.fromTotalCount(100, {
        page: 2,
        pageSize: 25,
      })

      expect(pagination.hasNext).toBe(true)
      expect(pagination.hasPrevious).toBe(true)
    })

    it('should calculate correct navigation flags for last page', () => {
      const pagination = Pagination.fromTotalCount(100, {
        page: 4,
        pageSize: 25,
      })

      expect(pagination.hasNext).toBe(false)
      expect(pagination.hasPrevious).toBe(true)
    })

    it('should handle single page scenario', () => {
      const pagination = Pagination.fromTotalCount(10, {
        pageSize: 25,
      })

      expect(pagination.page).toBe(1)
      expect(pagination.totalPages).toBe(1)
      expect(pagination.hasNext).toBe(false)
      expect(pagination.hasPrevious).toBe(false)
    })

    it('should calculate correct offset for different pages', () => {
      const firstPage = Pagination.fromTotalCount(100, {
        page: 1,
        pageSize: 10,
      })
      expect(firstPage.offset).toBe(0)

      const thirdPage = Pagination.fromTotalCount(100, {
        page: 3,
        pageSize: 10,
      })
      expect(thirdPage.offset).toBe(20)
    })
  })

  describe('constructor', () => {
    it('should create pagination with provided values', () => {
      const pagination = new Pagination(2, 25, 25, 4, true, true)

      expect(pagination.page).toBe(2)
      expect(pagination.pageSize).toBe(25)
      expect(pagination.offset).toBe(25)
      expect(pagination.totalPages).toBe(4)
      expect(pagination.hasNext).toBe(true)
      expect(pagination.hasPrevious).toBe(true)
    })

    it('should make properties readonly', () => {
      const pagination = new Pagination(1, 25, 0, 1, false, false)

      // TypeScript should prevent mutation of readonly properties
      expect(pagination.page).toBe(1)
      expect(pagination.pageSize).toBe(25)
      expect(pagination.offset).toBe(0)
      expect(pagination.totalPages).toBe(1)
      expect(pagination.hasNext).toBe(false)
      expect(pagination.hasPrevious).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle very large total counts', () => {
      const pagination = Pagination.fromTotalCount(1000000, {
        page: 1000,
        pageSize: 100,
      })

      expect(pagination.page).toBe(1000)
      expect(pagination.offset).toBe(99900)
      expect(pagination.totalPages).toBe(10000)
    })

    it('should handle fractional total pages correctly', () => {
      // 101 items with 25 per page = 4.04 pages, should round up to 5
      const pagination = Pagination.fromTotalCount(101, {
        pageSize: 25,
      })

      expect(pagination.totalPages).toBe(5)
    })

    it('should respect all boundaries together', () => {
      const pagination = Pagination.fromTotalCount(1000, {
        page: -10, // should become 1
        pageSize: 500, // should become maxPageSize
        maxPageSize: 50,
      })

      expect(pagination.page).toBe(1)
      expect(pagination.pageSize).toBe(50)
      expect(pagination.offset).toBe(0)
      expect(pagination.totalPages).toBe(20)
    })
  })
})
