#!/usr/bin/env tsx

import 'dotenv/config'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { eq, asc } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db } from '../client.js'
import { users, pins, tags, pinsTags } from '../schema/index.js'
import { DrizzleTagRepository } from '../repositories/tag-repository.js'

interface PinboardPin {
  href: string
  description: string
  extended: string
  meta: string
  hash: string
  time: string
  shared: string
  toread: string
  tags: string
}

async function importPinboard() {
  const exportPath = join(process.cwd(), 'pinboard_export.json')

  // Check if export file exists
  if (!existsSync(exportPath)) {
    console.log('no export json')
    return
  }

  console.log('📦 Found pinboard_export.json, starting import...')

  try {
    // Parse the export file
    const exportData: PinboardPin[] = JSON.parse(
      readFileSync(exportPath, 'utf-8')
    )
    console.log(`📄 Found ${exportData.length} pins to import`)

    // Find the oldest user
    const oldestUser = await db
      .select()
      .from(users)
      .orderBy(asc(users.createdAt))
      .limit(1)

    if (oldestUser.length === 0) {
      console.log('❌ No users found in database')
      return
    }

    const user = oldestUser[0]
    console.log(
      `👤 Importing for oldest user: ${user.username} (created: ${user.createdAt})`
    )

    // Initialize repositories
    const tagRepo = new DrizzleTagRepository(db)

    // Delete all existing pins for this user (cascades to pinsTags)
    console.log('🗑️  Deleting existing pins...')
    const deletedPins = await db.delete(pins).where(eq(pins.userId, user.id))
    console.log(`   Deleted ${deletedPins.rowCount || 0} existing pins`)

    // Delete all existing tags for this user (if they're not referenced by other users)
    console.log('🗑️  Deleting orphaned tags...')
    const userTags = await db
      .select({ id: tags.id })
      .from(tags)
      .where(eq(tags.userId, user.id))

    for (const tag of userTags) {
      // Check if this tag is still referenced by any pins
      const referencedPins = await db
        .select({ count: pins.id })
        .from(pinsTags)
        .innerJoin(pins, eq(pinsTags.pinId, pins.id))
        .where(eq(pinsTags.tagId, tag.id))
        .limit(1)

      if (referencedPins.length === 0) {
        await db.delete(tags).where(eq(tags.id, tag.id))
      }
    }

    // Import pins from Pinboard
    console.log('📥 Importing pins...')
    let importedCount = 0

    for (const pinboardPin of exportData) {
      // Parse the timestamp from Pinboard format (ISO 8601)
      const pinboardDate = new Date(pinboardPin.time)

      // Parse tags from space-separated string
      const tagNames = pinboardPin.tags
        .split(' ')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)

      // Create pin directly in database with custom timestamp
      const pinId = randomUUID()

      await db.insert(pins).values({
        id: pinId,
        userId: user.id,
        url: pinboardPin.href,
        title: pinboardPin.description,
        description: pinboardPin.extended || null,
        readLater: pinboardPin.toread === 'yes',
        createdAt: pinboardDate,
        updatedAt: pinboardDate,
      })

      // Handle tags if present
      if (tagNames.length > 0) {
        // Fetch or create tags
        const createdTags = await tagRepo.fetchOrCreateByNames(
          user.id,
          tagNames
        )

        // Associate tags with pin
        if (createdTags.length > 0) {
          await db.insert(pinsTags).values(
            createdTags.map(tag => ({
              pinId: pinId,
              tagId: tag.id,
            }))
          )
        }
      }

      importedCount++
      if (importedCount % 10 === 0) {
        console.log(`   Imported ${importedCount}/${exportData.length} pins...`)
      }
    }

    console.log(`✅ Import complete! Imported ${importedCount} pins`)

    // Show summary
    const finalPinCount = await db
      .select({ count: pins.id })
      .from(pins)
      .where(eq(pins.userId, user.id))

    const finalTagCount = await db
      .select({ count: tags.id })
      .from(tags)
      .where(eq(tags.userId, user.id))

    console.log(`📊 Final stats for ${user.username}:`)
    console.log(`   - Pins: ${finalPinCount.length}`)
    console.log(`   - Tags: ${finalTagCount.length}`)
  } catch (error) {
    console.error('❌ Import failed:', error)
    process.exit(1)
  }
}

// Run the import
importPinboard()
  .then(() => {
    console.log('🎉 Import script completed')
    process.exit(0)
  })
  .catch(error => {
    console.error('💥 Script failed:', error)
    process.exit(1)
  })
