import { IBudgetRepository } from '../../../domain/repositories/IBudgetRepository'
import { ICategoryRepository } from '../../../domain/repositories/ICategoryRepository'
import { ITransactionRepository } from '../../../domain/repositories/ITransactionRepository'
import { Budget } from '../../../domain/entities/Budget'
import { Category } from '../../../domain/entities/Category'
import { AppError } from '../../errors/AppError'

export type CreateBudgetInput = {
  categoryId: string
  amount: number
  month: number
  year: number
}

export type UpdateBudgetInput = Partial<CreateBudgetInput>

export type BudgetWithProgress = Budget & {
  categoryName: string
  categoryIcon?: string
  categoryColor?: string
  spent: number
  remaining: number
  percentage: number
}

export class BudgetUseCase {
  constructor(
    private budgetRepo: IBudgetRepository,
    private categoryRepo: ICategoryRepository,
    private transactionRepo: ITransactionRepository,
  ) {}

  async list(userId: string, month: number, year: number): Promise<BudgetWithProgress[]> {
    const budgets = await this.budgetRepo.findByPeriod(userId, month, year)
    if (budgets.length === 0) return []

    const [categories, summary] = await Promise.all([
      this.categoryRepo.findAllByUser(userId),
      this.transactionRepo.getCategorySummary(userId, ...this.periodRange(month, year)),
    ])
    const categoryMap = new Map(categories.map(c => [c.id, c]))
    const spentMap = new Map(summary.map(s => [s.categoryId, s.total]))

    return budgets.map(b => this.assemble(b, categoryMap.get(b.categoryId), spentMap.get(b.categoryId) ?? 0))
  }

  async create(userId: string, input: CreateBudgetInput): Promise<BudgetWithProgress> {
    if (input.amount <= 0) throw new AppError('O valor do orçamento deve ser maior que zero', 400)
    if (input.month < 1 || input.month > 12) throw new AppError('Mês inválido', 400)

    const category = await this.categoryRepo.findById(input.categoryId, userId)
    if (!category) throw new AppError('Categoria não encontrada', 404)
    if (category.type !== 'expense') throw new AppError('Orçamentos só podem ser criados para categorias de despesa', 400)

    const existing = await this.budgetRepo.findByCategoryAndPeriod(userId, input.categoryId, input.month, input.year)
    if (existing) throw new AppError('Já existe um orçamento para esta categoria neste período', 409)

    const budget = await this.budgetRepo.create({ userId, ...input })
    return this.toProgress(budget, category)
  }

  async update(id: string, userId: string, input: UpdateBudgetInput): Promise<BudgetWithProgress> {
    const budget = await this.budgetRepo.findById(id, userId)
    if (!budget) throw new AppError('Orçamento não encontrado', 404)

    if (input.amount !== undefined && input.amount <= 0) {
      throw new AppError('O valor do orçamento deve ser maior que zero', 400)
    }
    if (input.month !== undefined && (input.month < 1 || input.month > 12)) {
      throw new AppError('Mês inválido', 400)
    }

    let category = await this.categoryRepo.findById(budget.categoryId, userId)
    if (input.categoryId && input.categoryId !== budget.categoryId) {
      const newCategory = await this.categoryRepo.findById(input.categoryId, userId)
      if (!newCategory) throw new AppError('Categoria não encontrada', 404)
      if (newCategory.type !== 'expense') throw new AppError('Orçamentos só podem ser criados para categorias de despesa', 400)
      category = newCategory
    }

    const targetCategoryId = input.categoryId ?? budget.categoryId
    const targetMonth = input.month ?? budget.month
    const targetYear = input.year ?? budget.year
    const periodChanged = targetCategoryId !== budget.categoryId || targetMonth !== budget.month || targetYear !== budget.year
    if (periodChanged) {
      const existing = await this.budgetRepo.findByCategoryAndPeriod(userId, targetCategoryId, targetMonth, targetYear)
      if (existing && existing.id !== id) throw new AppError('Já existe um orçamento para esta categoria neste período', 409)
    }

    const updated = await this.budgetRepo.update(id, userId, input)
    return this.toProgress(updated, category!)
  }

  async delete(id: string, userId: string): Promise<void> {
    const budget = await this.budgetRepo.findById(id, userId)
    if (!budget) throw new AppError('Orçamento não encontrado', 404)
    await this.budgetRepo.delete(id, userId)
  }

  private async toProgress(budget: Budget, category: Category): Promise<BudgetWithProgress> {
    const summary = await this.transactionRepo.getCategorySummary(budget.userId, ...this.periodRange(budget.month, budget.year))
    const spent = summary.find(s => s.categoryId === budget.categoryId)?.total ?? 0
    return this.assemble(budget, category, spent)
  }

  private assemble(budget: Budget, category: Category | undefined, spent: number): BudgetWithProgress {
    return {
      ...budget,
      categoryName: category?.name ?? 'Categoria removida',
      categoryIcon: category?.icon,
      categoryColor: category?.color,
      spent,
      remaining: budget.amount - spent,
      percentage: budget.amount > 0 ? (spent / budget.amount) * 100 : 0,
    }
  }

  private periodRange(month: number, year: number): [Date, Date] {
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59, 999)
    return [startDate, endDate]
  }
}
