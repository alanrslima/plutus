import { IGoalRepository } from '../../../domain/repositories/IGoalRepository'
import { Goal, GoalStatus, GoalType } from '../../../domain/entities/Goal'
import { prisma } from '../prisma'

function toGoal(raw: {
  id: string; userId: string; categoryId: string | null; title: string
  targetAmount: { toNumber: () => number }; currentAmount: { toNumber: () => number }
  deadline: Date | null; type: string; status: string; source: string; createdAt: Date
}): Goal {
  return {
    id: raw.id,
    userId: raw.userId,
    categoryId: raw.categoryId ?? undefined,
    title: raw.title,
    targetAmount: raw.targetAmount.toNumber(),
    currentAmount: raw.currentAmount.toNumber(),
    deadline: raw.deadline ?? undefined,
    type: raw.type as GoalType,
    status: raw.status as GoalStatus,
    source: raw.source,
    createdAt: raw.createdAt,
  }
}

export class PrismaGoalRepository implements IGoalRepository {
  async findById(id: string, userId: string): Promise<Goal | null> {
    const g = await prisma.goal.findFirst({ where: { id, userId } })
    return g ? toGoal(g) : null
  }

  async findAllByUser(userId: string): Promise<Goal[]> {
    const goals = await prisma.goal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    return goals.map(toGoal)
  }

  async create(data: Omit<Goal, 'id' | 'createdAt' | 'currentAmount'>): Promise<Goal> {
    const g = await prisma.goal.create({
      data: {
        userId: data.userId,
        categoryId: data.categoryId ?? null,
        title: data.title,
        targetAmount: data.targetAmount,
        deadline: data.deadline ?? null,
        type: data.type,
        status: data.status,
        source: data.source,
      },
    })
    return toGoal(g)
  }

  async updateStatus(id: string, userId: string, status: GoalStatus): Promise<Goal> {
    const g = await prisma.goal.update({ where: { id }, data: { status } })
    return toGoal(g)
  }

  async updateCurrentAmount(id: string, userId: string, amount: number): Promise<Goal> {
    const g = await prisma.goal.update({ where: { id }, data: { currentAmount: amount } })
    return toGoal(g)
  }

  async delete(id: string, userId: string): Promise<void> {
    await prisma.goal.delete({ where: { id } })
  }
}
