import {
  createDatabaseClient,
  DrizzleUserRepository,
} from '@pinsquirrel/database'
import { AuthenticationService } from '@pinsquirrel/services'
import type { AdminEnvironment } from './config.js'

export interface EnvRuntime {
  userRepository: DrizzleUserRepository
  authService: AuthenticationService
}

// One DB client/repository set per environment, created lazily and reused.
const cache = new Map<string, EnvRuntime>()

export function getRuntime(env: AdminEnvironment): EnvRuntime {
  let runtime = cache.get(env.name)
  if (!runtime) {
    const db = createDatabaseClient(env.databaseUrl)
    const userRepository = new DrizzleUserRepository(db)
    runtime = {
      userRepository,
      authService: new AuthenticationService(userRepository),
    }
    cache.set(env.name, runtime)
  }
  return runtime
}
