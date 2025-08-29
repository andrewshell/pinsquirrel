import type { Tag } from './tag.js'

export interface Pin {
  id: string
  userId: string
  url: string
  title: string
  description: string | null
  readLater: boolean
  tags: Tag[]
  createdAt: Date
  updatedAt: Date
}

export interface CreatePinData {
  userId: string
  url: string
  title: string
  description?: string | null
  readLater?: boolean
  tagNames?: string[]
  createdAt?: Date
  updatedAt?: Date
}

export interface UpdatePinData {
  url?: string
  title?: string
  description?: string | null
  readLater?: boolean
  tagNames?: string[]
}

export interface UpdatePinInput extends UpdatePinData {
  userId: string
  pinId: string
}
