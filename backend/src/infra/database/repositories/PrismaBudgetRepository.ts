import { IBudgetRepository, CreateBudgetData, UpdateBudgetData } from '../../../domain/repositories/IBudgetRepository'
import { Budget } from '../../../domain/entities/Budget'
import { prisma } from '../prisma'

function toBudget(raw: {
  id: string
  userId: string
  categoryId: string
  amount: { toNumber: () => number }
  month: number
  year: number
  createdAt: Date
}): Budget {
  return {
    id: raw.id,
    userId: raw.userId,
    categoryId: raw.categoryId,
    amount: raw.amount.toNumber(),
    month: raw.month,
    year: raw.year,
    createdAt: raw.createdAt,
  }
}

export class PrismaBudgetRepository implements IBudgetRepository {
  async findById(id: string, userId: string): Promise<Budget | null> {
    const budget = await prisma.budget.findFirst({ where: { id, userId } })
    return budget ? toBudget(budget) : null
  }

  async findByPeriod(userId: string, month: number, year: number): Promise<Budget[]> {
    const budgets = await prisma.budget.findMany({
      where: { userId, month, year },
      orderBy: { createdAt: 'asc' },
    })
    return budgets.map(toBudget)
  }

  async findByCategoryAndPeriod(userId: string, categoryId: string, month: number, year: number): Promise<Budget | null> {
    const budget = await prisma.budget.findFirst({ where: { userId, categoryId, month, year } })
    return budget ? toBudget(budget) : null
  }

  async create(data: CreateBudgetData): Promise<Budget> {
    const budget = await prisma.budget.create({
      data: {
        userId: data.userId,
        categoryId: data.categoryId,
        amount: data.amount,
        month: data.month,
        year: data.year,
      },
    })
    return toBudget(budget)
  }

  async update(id: string, userId: string, data: UpdateBudgetData): Promise<Budget> {
    const budget = await prisma.budget.update({
      where: { id },
      data: {
        categoryId: data.categoryId,
        amount: data.amount,
        month: data.month,
        year: data.year,
      },
    })
    return toBudget(budget)
  }

  async delete(id: string, userId: string): Promise<void> {
    await prisma.budget.delete({ where: { id } })
  }
}
