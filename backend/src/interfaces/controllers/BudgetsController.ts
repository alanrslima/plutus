import { Response, NextFunction } from 'express'
import { z } from 'zod'
import { AuthRequest } from '../middlewares/authMiddleware'
import { BudgetUseCase } from '../../application/use-cases/budgets/BudgetUseCase'
import { PrismaBudgetRepository } from '../../infra/database/repositories/PrismaBudgetRepository'
import { PrismaCategoryRepository } from '../../infra/database/repositories/PrismaCategoryRepository'
import { PrismaTransactionRepository } from '../../infra/database/repositories/PrismaTransactionRepository'

const budgetRepo = new PrismaBudgetRepository()
const categoryRepo = new PrismaCategoryRepository()
const transactionRepo = new PrismaTransactionRepository()
const useCase = new BudgetUseCase(budgetRepo, categoryRepo, transactionRepo)

const listSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
})

const createSchema = z.object({
  categoryId: z.string().uuid(),
  amount: z.number().positive(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
})

const updateSchema = z.object({
  categoryId: z.string().uuid().optional(),
  amount: z.number().positive().optional(),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
})

export class BudgetsController {
  list = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { month, year } = listSchema.parse(req.query)
      const budgets = await useCase.list(req.userId!, month, year)
      res.json({ budgets })
    } catch (err) { next(err) }
  }

  create = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = createSchema.parse(req.body)
      const budget = await useCase.create(req.userId!, data)
      res.status(201).json(budget)
    } catch (err) { next(err) }
  }

  update = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = updateSchema.parse(req.body)
      const budget = await useCase.update(req.params.id, req.userId!, data)
      res.json(budget)
    } catch (err) { next(err) }
  }

  delete = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await useCase.delete(req.params.id, req.userId!)
      res.status(204).send()
    } catch (err) { next(err) }
  }
}
