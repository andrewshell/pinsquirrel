import type { Pin, CreatePinData, UpdatePinData } from '../entities/pin.js'
import type { Repository } from './repository.js'

export interface PinRepository
  extends Repository<Pin, CreatePinData, UpdatePinData> {
  findByUserId(
    userId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Pin[]>
  findByUserIdWithFilter(
    userId: string,
    filter: { readLater?: boolean },
    options?: { limit?: number; offset?: number }
  ): Promise<Pin[]>
  findByUserIdAndTag(userId: string, tagId: string): Promise<Pin[]>
  findByUserIdAndReadLater(userId: string, readLater: boolean): Promise<Pin[]>
  findByUserIdAndUrl(userId: string, url: string): Promise<Pin | null>
  countByUserId(userId: string): Promise<number>
  countByUserIdWithFilter(
    userId: string,
    filter: { readLater?: boolean }
  ): Promise<number>
}
