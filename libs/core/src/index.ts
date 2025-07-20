// Entities
export type { User, CreateUserData, UpdateUserData } from './entities/user.js'

// Interfaces
export type { Repository } from './interfaces/repository.js'
export type { UserRepository } from './interfaces/user-repository.js'
export type { AuthenticationService } from './interfaces/authentication-service.js'

// Services
export { AuthenticationServiceImpl } from './services/authentication-service.js'

// Errors
export { AuthenticationError, InvalidCredentialsError, UserAlreadyExistsError } from './errors/auth-errors.js'

// Utils
export { hashPassword, verifyPassword, hashEmail } from './utils/crypto.js'