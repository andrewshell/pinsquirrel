export interface Tag {
  id: string
  userId: string
  name: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateTagData {
  userId: string
  name: string
}

export interface UpdateTagData {
  name?: string
}
