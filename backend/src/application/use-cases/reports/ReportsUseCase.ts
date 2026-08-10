import { ITransactionRepository } from '../../../domain/repositories/ITransactionRepository'
import { IAccountRepository } from '../../../domain/repositories/IAccountRepository'

export class ReportsUseCase {
  constructor(
    private transactionRepository: ITransactionRepository,
    private accountRepository: IAccountRepository,
  ) {}

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

  async getCumulativeSummary(userId: string, endDate: Date) {
    return this.transactionRepository.getCumulativeSummary(userId, endDate)
  }

  async getBalanceAsOfDate(userId: string, date: Date) {
    const accounts = await this.accountRepository.findAllByUser(userId)
    const currentBalance = accounts.reduce((sum, a) => sum + a.balance, 0)
    const { totalIncome, totalExpense } = await this.transactionRepository.getSummarySince(userId, date)
    return { balance: currentBalance - (totalIncome - totalExpense) }
  }
}
