import { ITransactionRepository } from '../../../domain/repositories/ITransactionRepository'

export class ReportsUseCase {
  constructor(private transactionRepository: ITransactionRepository) {}

  async getMonthlySummary(userId: string, year: number, month?: number) {
    return this.transactionRepository.getMonthlySummary(userId, year, month)
  }

  async getCategorySummary(userId: string, startDate?: Date, endDate?: Date) {
    return this.transactionRepository.getCategorySummary(userId, startDate, endDate)
  }

  async getCategoryTrend(userId: string, year: number, type: 'income' | 'expense') {
    return this.transactionRepository.getCategoryTrend(userId, year, type)
  }

  async getAccountSummary(userId: string) {
    return this.transactionRepository.getAccountSummary(userId)
  }

  async getDailySummary(userId: string, year: number, month: number) {
    return this.transactionRepository.getDailySummary(userId, year, month)
  }
}
