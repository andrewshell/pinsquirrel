import type { User } from './user'
import type { Role } from './role'

export interface AccessGateable {
  userId: string
}

export class AccessControl {
  readonly user: User | null

  constructor(user?: User | null) {
    this.user = user ?? null
  }

  hasRole(role: Role): boolean {
    if (!this.user) return false
    return this.user.roles.includes(role)
  }

  canCreateAs(userId: string): boolean {
    if (!this.user) return false
    return this.user.id === userId
  }

  canRead(ag: AccessGateable | User): boolean {
    if (!this.user) return false
    const userId = 'userId' in ag ? ag.userId : ag.id
    return this.user.id === userId
  }

  canUpdate(ag: AccessGateable | User): boolean {
    if (!this.user) return false
    const userId = 'userId' in ag ? ag.userId : ag.id
    return this.user.id === userId
  }

  canDelete(ag: AccessGateable | User): boolean {
    if (!this.user) return false
    const userId = 'userId' in ag ? ag.userId : ag.id
    return this.user.id === userId
  }
}
