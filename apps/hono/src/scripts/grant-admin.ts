import 'dotenv/config'
import {
  createDatabaseClient,
  DrizzleUserRepository,
} from '@pinsquirrel/database'
import { Role } from '@pinsquirrel/domain'

/**
 * Manually grant a user the Admin role.
 *
 * Usage:
 *   pnpm --filter @pinsquirrel/hono grant-admin <username>
 *
 * Roles are additive: this adds Admin alongside the user's existing roles. The
 * User role and active status (required to sign in) are left untouched.
 * Idempotent: re-running on an existing admin reports no change.
 */
async function main(): Promise<void> {
  const username = process.argv[2]
  if (!username) {
    console.error(
      'Usage: pnpm --filter @pinsquirrel/hono grant-admin <username>'
    )
    process.exit(1)
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }

  const db = createDatabaseClient(databaseUrl)
  const userRepository = new DrizzleUserRepository(db)

  const user = await userRepository.findByUsername(username)
  if (!user) {
    console.error(`User "${username}" not found`)
    process.exit(1)
  }

  if (user.roles.includes(Role.Admin)) {
    console.log(`No change: "${user.username}" is already an admin.`)
    process.exit(0)
  }

  await userRepository.addRole(user.id, Role.Admin)
  console.log(`Granted the Admin role to "${user.username}".`)
  process.exit(0)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
