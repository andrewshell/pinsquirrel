import { PinServiceImpl } from '@pinsquirrel/core'
import { DrizzlePinRepository, DrizzleTagRepository, db } from '@pinsquirrel/database'

// Create singleton instances
const tagRepository = new DrizzleTagRepository(db)
const pinRepository = new DrizzlePinRepository(db, tagRepository)
export const pinService = new PinServiceImpl(pinRepository, tagRepository)