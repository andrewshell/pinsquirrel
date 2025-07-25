#!/usr/bin/env tsx

import 'dotenv/config'
import { seed } from 'drizzle-seed'
import { eq, and } from 'drizzle-orm'
import { db } from '../client.js'
import { pins, tags, pinsTags } from '../schema/index.js'
import { DrizzleUserRepository } from '../repositories/user-repository.js'

interface SeedOptions {
  pinCount?: number
  tagCount?: number
  resetDatabase?: boolean
  seedValue?: number
}

async function seedPins(options: SeedOptions = {}) {
  const {
    pinCount = 35,
    tagCount = 20,
    resetDatabase = false,
    seedValue = 42
  } = options

  console.log('🌱 Starting database seeding with drizzle-seed...')
  console.log(`📊 Configuration:`)
  console.log(`   - Pin count: ${pinCount}`)
  console.log(`   - Tag count: ${tagCount}`)
  console.log(`   - Reset database: ${resetDatabase}`)
  console.log(`   - Seed value: ${seedValue}`)

  try {
    // Check for existing users
    const userRepository = new DrizzleUserRepository(db)
    const existingUsers = await userRepository.findAll()

    if (existingUsers.length === 0) {
      console.log(`❌ No users found in database.`)
      console.log(`\n💡 To use this seeding script:`)
      console.log(`   1. Register a user through the web app`)
      console.log(`   2. Then run: pnpm --filter @pinsquirrel/database seed:pins`)
      console.log(`\n   This will create realistic test data for all existing users.`)
      process.exit(1)
    }

    console.log(`👥 Found ${existingUsers.length} user(s) in database`)

    if (resetDatabase) {
      console.log('🗑️ Resetting database...')
      // Delete in order to respect foreign key constraints
      await db.delete(pinsTags)
      await db.delete(pins)
      await db.delete(tags)
      console.log('✅ Database reset complete')
    }

    // Use drizzle-seed to generate realistic data
    console.log('🎲 Generating realistic test data...')
    
    // First, generate tags and pins separately
    await seed(db, { tags, pins }, { seed: seedValue }).refine((funcs) => ({
      tags: {
        count: tagCount,
        columns: {
          name: funcs.valuesFromArray({
            values: [
              'react', 'javascript', 'typescript', 'node', 'css', 'html',
              'frontend', 'backend', 'fullstack', 'api', 'database', 'sql',
              'docker', 'git', 'github', 'testing', 'performance', 'security',
              'design', 'ui', 'ux', 'documentation', 'tutorial', 'guide',
              'framework', 'library', 'tools', 'development', 'productivity',
              'web', 'mobile', 'desktop', 'cloud', 'devops', 'automation'
            ],
            isUnique: true
          }),
          userId: funcs.valuesFromArray({
            values: existingUsers.map(u => u.id)
          })
        }
      },
      pins: {
        count: pinCount,
        columns: {
          url: funcs.valuesFromArray({
            values: (() => {
              const domains = [
                'developer.mozilla.org',
                'stackoverflow.com',
                'github.com',
                'medium.com',
                'dev.to',
                'css-tricks.com',
                'web.dev',
                'freecodecamp.org',
                'hashnode.com',
                'codepen.io',
                'smashingmagazine.com',
                'alistapart.com',
                'codrops.com',
                'css-weekly.com',
                'javascript.info'
              ]
              
              const urls = []
              for (let i = 0; i < pinCount * 2; i++) {
                const domain = domains[i % domains.length]
                const uuid = crypto.randomUUID()
                urls.push(`https://${domain}/${uuid}`)
              }
              return urls
            })()
          }),
          title: funcs.valuesFromArray({
            values: Array.from({ length: 50 }, (_, i) => `Article Title ${i + 1}`)
          }),
          description: funcs.valuesFromArray({
            values: Array.from({ length: 30 }, (_, i) => `This is a description for article ${i + 1}. It provides useful information about the topic.`)
          }),
          readLater: funcs.valuesFromArray({
            values: [false, false, false, false, false, false, false, true, true, true]
          }),
          userId: funcs.valuesFromArray({
            values: existingUsers.map(u => u.id)
          })
        }
      }
    }))

    // Now create pin-tag relationships manually
    console.log('🔗 Creating pin-tag relationships...')
    const allPins = await db.select().from(pins)
    const allTags = await db.select().from(tags)
    
    const relationships = []
    for (const pin of allPins) {
      // Give each pin 2-4 random tags
      const numTags = Math.floor(Math.random() * 3) + 2 // 2-4 tags
      const shuffledTags = [...allTags].sort(() => Math.random() - 0.5)
      const selectedTags = shuffledTags.slice(0, numTags)
      
      for (const tag of selectedTags) {
        relationships.push({
          pinId: pin.id,
          tagId: tag.id
        })
      }
    }
    
    // Insert relationships in batches to avoid duplicates
    const uniqueRelationships = relationships.filter((rel, index, self) => 
      index === self.findIndex(r => r.pinId === rel.pinId && r.tagId === rel.tagId)
    )
    
    if (uniqueRelationships.length > 0) {
      await db.insert(pinsTags).values(uniqueRelationships)
    }

    // Get final stats
    const stats = await Promise.all(
      existingUsers.map(async (user) => {
        const totalPins = await db.select().from(pins).where(eq(pins.userId, user.id))
        const readLaterPins = await db.select().from(pins).where(and(eq(pins.userId, user.id), eq(pins.readLater, true)))
        
        return {
          username: user.username,
          total: totalPins.length,
          readLater: readLaterPins.length
        }
      })
    )

    console.log(`\n🎉 Seeding complete!`)
    console.log(`📈 Final stats:`)
    stats.forEach(stat => {
      console.log(`   👤 ${stat.username}: ${stat.total} pins (${stat.readLater} read later)`)
    })

    const totalTags = await db.select().from(tags)
    console.log(`   🏷️ Tags created: ${totalTags.length}`)

    process.exit(0)
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const options: SeedOptions = {}

args.forEach(arg => {
  if (arg.startsWith('--pins=')) {
    options.pinCount = parseInt(arg.split('=')[1])
  } else if (arg.startsWith('--tags=')) {
    options.tagCount = parseInt(arg.split('=')[1])
  } else if (arg === '--reset') {
    options.resetDatabase = true
  } else if (arg.startsWith('--seed=')) {
    options.seedValue = parseInt(arg.split('=')[1])
  }
})

console.log(`\n💡 Usage: pnpm seed:pins [--pins=35] [--tags=20] [--reset] [--seed=42]`)
console.log(`   --pins=N    Number of pins to generate (default: 35)`)
console.log(`   --tags=N    Number of tags to generate (default: 20)`)
console.log(`   --reset     Reset database before seeding`)
console.log(`   --seed=N    Seed value for deterministic generation (default: 42)`)
console.log(``)

// Run the seeding
seedPins(options)