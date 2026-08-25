export interface Repository<T, CreateData, UpdateData> {
  findById(id: string): Promise<T | null>
  create(data: CreateData): Promise<T>
  update(id: string, data: UpdateData): Promise<T | null>
  delete(id: string): Promise<boolean>
}
