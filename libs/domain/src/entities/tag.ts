import type { AccessGateable } from './access'

export interface Tag extends AccessGateable {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
}

export type CreateTagData = Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>

export type UpdateTagData = Omit<Tag, 'createdAt' | 'updatedAt'>

// Service-level input types (without userId - will be provided by AccessControl)
export type ServiceCreateTagData = Omit<CreateTagData, 'userId'>

export type ServiceUpdateTagData = Omit<UpdateTagData, 'userId'>

export interface TagWithCount extends Tag {
  pinCount: number
}
