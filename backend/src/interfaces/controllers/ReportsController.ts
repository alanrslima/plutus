import { Response, NextFunction } from 'express'
import { AuthRequest } from '../middlewares/authMiddleware'
import { ReportsUseCase } from '../../application/use-cases/reports/ReportsUseCase'
import { PrismaTransactionRepository } from '../../infra/database/repositories/PrismaTransactionRepository'
import { PrismaAccountRepository } from '../../infra/database/repositories/PrismaAccountRepository'

const transactionRepo = new PrismaTransactionRepository()
const accountRepo = new PrismaAccountRepository()
const useCase = new ReportsUseCase(transactionRepo, accountRepo)

export class ReportsController {
  async monthlySummary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear()
      const month = req.query.month ? parseInt(req.query.month as string) : undefined
      const result = await useCase.getMonthlySummary(req.userId!, year, month)
      res.json(result)
    } catch (err) { next(err) }
  }

  async categorySummary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query
      const result = await useCase.getCategorySummary(
        req.userId!,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
      )
      res.json(result)
    } catch (err) { next(err) }
  }

  async categoryTrend(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear()
      const type = (req.query.type as string) === 'income' ? 'income' : 'expense'
      const result = await useCase.getCategoryTrend(req.userId!, year, type as 'income' | 'expense')
      res.json(result)
    } catch (err) { next(err) }
  }

  async accountSummary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await useCase.getAccountSummary(req.userId!)
      res.json(result)
    } catch (err) { next(err) }
  }

  async dailySummary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear()
      const month = req.query.month ? parseInt(req.query.month as string) : new Date().getMonth() + 1
      const result = await useCase.getDailySummary(req.userId!, year, month)
      res.json(result)
    } catch (err) { next(err) }
  }

  async cumulativeSummary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date()
      const result = await useCase.getCumulativeSummary(req.userId!, endDate)
      res.json(result)
    } catch (err) { next(err) }
  }

  async balanceAsOfDate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const date = req.query.date ? new Date(req.query.date as string) : new Date()
      const result = await useCase.getBalanceAsOfDate(req.userId!, date)
      res.json(result)
    } catch (err) { next(err) }
  }
}
