import type { User } from './user'

export interface AccessGateable {
  userId: string
}

export class AccessControl {
  readonly user: User | null

  constructor(user?: User | null) {
    this.user = user ?? null
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
