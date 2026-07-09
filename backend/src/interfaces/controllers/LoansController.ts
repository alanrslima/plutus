import { Response, NextFunction } from 'express'
import { z } from 'zod'
import { AuthRequest } from '../middlewares/authMiddleware'
import { LoanUseCase } from '../../application/use-cases/loans/LoanUseCase'
import { PrismaLoanRepository } from '../../infra/database/repositories/PrismaLoanRepository'

const loanRepo = new PrismaLoanRepository()
const useCase = new LoanUseCase(loanRepo)

const createSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  lender: z.string().optional(),
  amountReceived: z.number().positive(),
  totalAmount: z.number().positive(),
  installmentsCount: z.number().int().min(1),
  startDate: z.string(),
  firstDueDate: z.string(),
  notes: z.string().optional(),
})

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  lender: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['active', 'paid', 'cancelled']).optional(),
})

export class LoansController {
  list = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const loans = await useCase.list(req.userId!)
      res.json({ loans })
    } catch (err) { next(err) }
  }

  getById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const loan = await useCase.getById(req.params.id, req.userId!)
      res.json(loan)
    } catch (err) { next(err) }
  }

  create = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = createSchema.parse(req.body)
      const loan = await useCase.create(req.userId!, {
        ...data,
        startDate: new Date(data.startDate),
        firstDueDate: new Date(data.firstDueDate),
      })
      res.status(201).json(loan)
    } catch (err) { next(err) }
  }

  update = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = updateSchema.parse(req.body)
      const loan = await useCase.update(req.params.id, req.userId!, data)
      res.json(loan)
    } catch (err) { next(err) }
  }

  delete = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await useCase.delete(req.params.id, req.userId!)
      res.status(204).send()
    } catch (err) { next(err) }
  }

  payInstallment = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const loan = await useCase.payInstallment(req.params.installmentId, req.userId!)
      res.json(loan)
    } catch (err) { next(err) }
  }

  unpayInstallment = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const loan = await useCase.unpayInstallment(req.params.installmentId, req.userId!)
      res.json(loan)
    } catch (err) { next(err) }
  }
}
