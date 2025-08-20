import type { Pin, CreatePinData, UpdatePinData } from '../entities/pin.js'

export interface PinFilter {
  readLater?: boolean
  tag?: string
  tagId?: string
  url?: string
}

export interface PinRepository {
  // Core CRUD operations (user-scoped for security)
  findById(id: string): Promise<Pin | null>
  create(data: CreatePinData): Promise<Pin>
  update(id: string, data: UpdatePinData): Promise<Pin | null>
  delete(id: string): Promise<boolean>

  // User-scoped queries (secure by design)
  findByUserId(
    userId: string,
    filter?: PinFilter,
    options?: { limit?: number; offset?: number }
  ): Promise<Pin[]>
  findByUserIdAndUrl(userId: string, url: string): Promise<Pin | null>
  countByUserId(userId: string, filter?: PinFilter): Promise<number>
}
