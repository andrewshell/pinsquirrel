import 'dotenv/config'
import {
  createDatabaseClient,
  DrizzleUserRepository,
} from '@pinsquirrel/database'
import { AuthenticationService } from '@pinsquirrel/services'

/**
 * Manually grant a waitlisted user access to the application.
 *
 * Usage:
 *   pnpm --filter @pinsquirrel/hono grant-access <username>
 *
 * Moves the user from the early-access waitlist into the active state so they
 * can sign in. Idempotent: granting an already-active user reports no change.
 */
async function main(): Promise<void> {
  const username = process.argv[2]
  if (!username) {
    console.error(
      'Usage: pnpm --filter @pinsquirrel/hono grant-access <username>'
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
  const authService = new AuthenticationService(userRepository)

  const user = await userRepository.findByUsername(username)
  if (!user) {
    console.error(`User "${username}" not found`)
    process.exit(1)
  }

  const previousStatus = user.status
  const updated = await authService.grantAccess(user.id)

  if (previousStatus === updated.status) {
    console.log(
      `No change: "${updated.username}" is already "${updated.status}".`
    )
  } else {
    console.log(
      `Granted access to "${updated.username}" (${previousStatus} -> ${updated.status}).`
    )
  }

  process.exit(0)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
