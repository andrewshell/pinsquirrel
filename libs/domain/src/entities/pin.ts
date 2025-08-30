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

// Service-level input types (without userId - will be provided by AccessControl)
export type ServiceCreatePinData = {
  url: string
  title: string
  description?: string | null
  readLater?: boolean
  tagNames?: string[]
}

export type ServiceUpdatePinData = {
  id: string
  url?: string
  title?: string
  description?: string | null
  readLater?: boolean
  tagNames?: string[]
}
