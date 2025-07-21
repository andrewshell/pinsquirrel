import type { Tag } from './tag.js'

export interface Pin {
  id: string
  userId: string
  url: string
  title: string
  description: string | null
  readLater: boolean
  contentPath: string | null
  imagePath: string | null
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
  contentPath?: string | null
  imagePath?: string | null
  tagNames?: string[]
}

export interface UpdatePinData {
  url?: string
  title?: string
  description?: string | null
  readLater?: boolean
  contentPath?: string | null
  imagePath?: string | null
  tagNames?: string[]
}
