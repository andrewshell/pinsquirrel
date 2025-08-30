import type { AccessGateable } from './access'

export interface Tag extends AccessGateable {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
}

export type CreateTagData = Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>

export type UpdateTagData = Omit<Tag, 'createdAt' | 'updatedAt'>

export interface TagWithCount extends Tag {
  pinCount: number
}
