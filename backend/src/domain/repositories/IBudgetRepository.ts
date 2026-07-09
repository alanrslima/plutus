import { Budget } from '../entities/Budget'

export type CreateBudgetData = Omit<Budget, 'id' | 'createdAt'>
export type UpdateBudgetData = Partial<Pick<Budget, 'categoryId' | 'amount' | 'month' | 'year'>>

export interface IBudgetRepository {
  findById(id: string, userId: string): Promise<Budget | null>
  findByPeriod(userId: string, month: number, year: number): Promise<Budget[]>
  findByCategoryAndPeriod(userId: string, categoryId: string, month: number, year: number): Promise<Budget | null>
  create(data: CreateBudgetData): Promise<Budget>
  update(id: string, userId: string, data: UpdateBudgetData): Promise<Budget>
  delete(id: string, userId: string): Promise<void>
}
