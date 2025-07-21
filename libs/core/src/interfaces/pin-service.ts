import type { Pin } from '../entities/pin.js'
import type { Tag } from '../entities/tag.js'
import type {
  CreatePinInput,
  UpdatePinInput,
  CreateTagInput,
} from '../validation/pin-schemas.js'

export interface PinService {
  // Pin operations
  createPin(userId: string, data: CreatePinInput): Promise<Pin>
  updatePin(userId: string, pinId: string, data: UpdatePinInput): Promise<Pin>
  deletePin(userId: string, pinId: string): Promise<void>
  getPin(userId: string, pinId: string): Promise<Pin>
  getUserPins(userId: string): Promise<Pin[]>
  getReadLaterPins(userId: string): Promise<Pin[]>
  getPinsByTag(userId: string, tagId: string): Promise<Pin[]>

  // Tag operations
  createTag(userId: string, data: CreateTagInput): Promise<Tag>
  getUserTags(userId: string): Promise<Tag[]>
  deleteTag(userId: string, tagId: string): Promise<void>

  // Content/Image management
  updatePinContent(
    userId: string,
    pinId: string,
    contentPath: string | null
  ): Promise<void>
  updatePinImage(
    userId: string,
    pinId: string,
    imagePath: string | null
  ): Promise<void>
}
