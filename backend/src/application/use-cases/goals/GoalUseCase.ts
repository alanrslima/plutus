import { IGoalRepository } from '../../../domain/repositories/IGoalRepository'
import { Goal, GoalStatus, GoalType } from '../../../domain/entities/Goal'
import { AppError } from '../../errors/AppError'

export interface CreateGoalInput {
  title: string
  targetAmount: number
  type: GoalType
  categoryId?: string
  deadline?: Date
  source?: string
}

export class GoalUseCase {
  constructor(private goalRepo: IGoalRepository) {}

  async list(userId: string): Promise<Goal[]> {
    return this.goalRepo.findAllByUser(userId)
  }

  async create(userId: string, input: CreateGoalInput): Promise<Goal> {
    return this.goalRepo.create({
      userId,
      title: input.title,
      targetAmount: input.targetAmount,
      type: input.type,
      status: 'active',
      categoryId: input.categoryId,
      deadline: input.deadline,
      source: input.source ?? 'manual',
    })
  }

  async updateStatus(id: string, userId: string, status: GoalStatus): Promise<Goal> {
    const goal = await this.goalRepo.findById(id, userId)
    if (!goal) throw new AppError('Goal not found', 404)
    return this.goalRepo.updateStatus(id, userId, status)
  }

  async delete(id: string, userId: string): Promise<void> {
    const goal = await this.goalRepo.findById(id, userId)
    if (!goal) throw new AppError('Goal not found', 404)
    return this.goalRepo.delete(id, userId)
  }
}
