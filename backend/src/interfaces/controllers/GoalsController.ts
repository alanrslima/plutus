import { Response, NextFunction } from 'express'
import { z } from 'zod'
import { AuthRequest } from '../middlewares/authMiddleware'
import { GoalUseCase } from '../../application/use-cases/goals/GoalUseCase'
import { PrismaGoalRepository } from '../../infra/database/repositories/PrismaGoalRepository'

const goalRepo = new PrismaGoalRepository()
const useCase = new GoalUseCase(goalRepo)

const createSchema = z.object({
  title: z.string().min(1),
  targetAmount: z.number().positive(),
  type: z.enum(['spending_limit', 'savings_target']),
  categoryId: z.string().uuid().optional(),
  deadline: z.string().optional(),
})

const statusSchema = z.object({
  status: z.enum(['active', 'achieved', 'cancelled']),
})

export class GoalsController {
  list = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const goals = await useCase.list(req.userId!)
      res.json({ goals })
    } catch (err) { next(err) }
  }

  create = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = createSchema.parse(req.body)
      const goal = await useCase.create(req.userId!, {
        ...data,
        deadline: data.deadline ? new Date(data.deadline) : undefined,
      })
      res.status(201).json(goal)
    } catch (err) { next(err) }
  }

  updateStatus = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status } = statusSchema.parse(req.body)
      const goal = await useCase.updateStatus(req.params.id, req.userId!, status)
      res.json(goal)
    } catch (err) { next(err) }
  }

  delete = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await useCase.delete(req.params.id, req.userId!)
      res.status(204).send()
    } catch (err) { next(err) }
  }
}
