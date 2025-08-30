import type { AccessGateable } from './access'

export interface Pin extends AccessGateable {
  id: string
  url: string
  title: string
  description: string | null
  readLater: boolean
  tagNames: string[]
  createdAt: Date
  updatedAt: Date
}

export type CreatePinData = Omit<Pin, 'id' | 'createdAt' | 'updatedAt'>

export type UpdatePinData = Omit<Pin, 'createdAt' | 'updatedAt'>
