import type { User } from './user'

export interface AccessGateable {
  userId: string
}

export class AccessControl {
  readonly user: User | null

  constructor(user?: User | null) {
    this.user = user ?? null
  }

  canCreate(): boolean {
    return !!this.user
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
