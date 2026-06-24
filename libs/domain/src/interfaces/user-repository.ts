import type { User, CreateUserData, UpdateUserData } from '../entities/user.js'
import type { Role } from '../entities/role.js'
import type { UserStatus } from '../entities/user-status.js'
import type { Repository } from './repository.js'

export interface UserRepository extends Repository<
  User,
  CreateUserData,
  UpdateUserData
> {
  findByEmailHash(emailHash: string): Promise<User | null>
  findByUsername(username: string): Promise<User | null>
  findByStatus(status: UserStatus): Promise<User[]>
  addRole(userId: string, role: Role): Promise<void>
}
