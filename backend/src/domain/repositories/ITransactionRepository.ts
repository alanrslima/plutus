import { Transaction } from '../entities/Transaction'
import { TransactionType } from '../entities/Category'

export interface TransactionFilters {
  accountId?: string
  categoryId?: string
  type?: TransactionType
  startDate?: Date
  endDate?: Date
}

export interface ITransactionRepository {
  findById(id: string, userId: string): Promise<Transaction | null>
  findAllByUser(userId: string, filters?: TransactionFilters): Promise<Transaction[]>
  findTransferPair(t: Transaction, userId: string): Promise<Transaction | null>
  createMany(data: Omit<Transaction, 'id' | 'createdAt'>[]): Promise<Transaction[]>
  update(id: string, userId: string, data: Partial<Omit<Transaction, 'id' | 'userId' | 'createdAt'>>): Promise<Transaction>
  delete(id: string, userId: string): Promise<void>
  deleteByParentId(parentTransactionId: string, userId: string): Promise<void>
  getMonthlySummary(userId: string, year: number, month?: number): Promise<{ month: string; totalIncome: number; totalExpense: number; balance: number }[]>
  getCategorySummary(userId: string, startDate?: Date, endDate?: Date): Promise<{ categoryId: string; categoryName: string; total: number }[]>
  getAccountSummary(userId: string): Promise<{ accountId: string; accountName: string; balance: number }[]>
}
