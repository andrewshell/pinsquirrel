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

  canRead(ag: AccessGateable): boolean {
    if (!this.user) return false
    return this.user.id === ag.userId
  }

  canUpdate(ag: AccessGateable): boolean {
    if (!this.user) return false
    return this.user.id === ag.userId
  }

  canDelete(ag: AccessGateable): boolean {
    if (!this.user) return false
    return this.user.id === ag.userId
  }
}
