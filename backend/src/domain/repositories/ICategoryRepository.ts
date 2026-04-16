import { Category } from '../entities/Category'
import { TransactionType } from '../entities/Category'

export interface ICategoryRepository {
  findById(id: string, userId: string): Promise<Category | null>
  findAllByUser(userId: string, type?: TransactionType): Promise<Category[]>
  create(data: Omit<Category, 'id' | 'createdAt'>): Promise<Category>
  createMany(data: Omit<Category, 'id' | 'createdAt'>[]): Promise<void>
  update(id: string, userId: string, data: Partial<Pick<Category, 'name' | 'type'>>): Promise<Category>
  delete(id: string, userId: string): Promise<void>
}
