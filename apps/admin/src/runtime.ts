import { createDatabaseClient, createRepositories } from '@pinsquirrel/database'
import { AuthenticationService, UserService } from '@pinsquirrel/services'
import type { AdminEnvironment } from './config.js'

export interface EnvRuntime {
  authService: AuthenticationService
  userService: UserService
}

// One DB client/repository set per environment, created lazily and reused.
const cache = new Map<string, EnvRuntime>()

export function getRuntime(env: AdminEnvironment): EnvRuntime {
  let runtime = cache.get(env.name)
  if (!runtime) {
    const db = createDatabaseClient(env.databaseUrl)
    const { userRepository } = createRepositories(db)
    runtime = {
      authService: new AuthenticationService(userRepository),
      userService: new UserService(userRepository),
    }
    cache.set(env.name, runtime)
  }
  return runtime
}
