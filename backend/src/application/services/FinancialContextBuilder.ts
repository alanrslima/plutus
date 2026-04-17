import { prisma } from '../../infra/database/prisma'
import { IGoalRepository } from '../../domain/repositories/IGoalRepository'
import { RecurringDetector, RecurringExpense } from './RecurringDetector'

export interface CategoryBreakdown {
  categoryId: string
  categoryName: string
  currentMonth: number
  previousMonth: number
  sixMonthAvg: number
  percentOfIncome: number
  trend: 'up' | 'down' | 'stable'
}

export interface FinancialContext {
  period: { current: string; previous: string }
  summary: {
    currentMonth: { income: number; expense: number; balance: number }
    previousMonth: { income: number; expense: number; balance: number }
    sixMonthAvgExpense: number
    sixMonthAvgIncome: number
  }
  categoryBreakdown: CategoryBreakdown[]
  recurringExpenses: RecurringExpense[]
  accounts: { name: string; balance: number }[]
  existingGoals: { title: string; type: string; targetAmount: number }[]
  dataMonths: number
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function startOf(year: number, month: number): Date {
  return new Date(year, month - 1, 1)
}

function endOf(year: number, month: number): Date {
  return new Date(year, month, 0, 23, 59, 59, 999)
}

export class FinancialContextBuilder {
  constructor(
    private goalRepo: IGoalRepository,
    private recurringDetector: RecurringDetector,
  ) {}

  async build(userId: string): Promise<FinancialContext> {
    const now = new Date()
    const curYear = now.getFullYear()
    const curMonth = now.getMonth() + 1

    const prevMonth = curMonth === 1 ? 12 : curMonth - 1
    const prevYear = curMonth === 1 ? curYear - 1 : curYear

    // ── Fetch last 7 months of transactions ──────────────────
    const sevenMonthsAgo = new Date(curYear, curMonth - 8, 1)
    const allTx = await prisma.transaction.findMany({
      where: { userId, date: { gte: sevenMonthsAgo }, type: { in: ['income', 'expense'] } },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { date: 'asc' },
    })

    // ── Monthly aggregates ────────────────────────────────────
    const monthlyIncome: Record<string, number> = {}
    const monthlyExpense: Record<string, number> = {}
    const distinctMonths = new Set<string>()

    for (const t of allTx) {
      const mk = monthKey(t.date)
      distinctMonths.add(mk)
      if (t.type === 'income') monthlyIncome[mk] = (monthlyIncome[mk] ?? 0) + t.amount.toNumber()
      else monthlyExpense[mk] = (monthlyExpense[mk] ?? 0) + t.amount.toNumber()
    }

    const currentKey = monthKey(startOf(curYear, curMonth))
    const previousKey = monthKey(startOf(prevYear, prevMonth))

    const curIncome = monthlyIncome[currentKey] ?? 0
    const curExpense = monthlyExpense[currentKey] ?? 0
    const prevIncome = monthlyIncome[previousKey] ?? 0
    const prevExpense = monthlyExpense[previousKey] ?? 0

    // 6-month average (excluding current month)
    const historicKeys = [...distinctMonths].filter(k => k !== currentKey)
    const sixKeys = historicKeys.slice(-6)
    const sixMonthAvgExpense = sixKeys.length
      ? sixKeys.reduce((s, k) => s + (monthlyExpense[k] ?? 0), 0) / sixKeys.length
      : 0
    const sixMonthAvgIncome = sixKeys.length
      ? sixKeys.reduce((s, k) => s + (monthlyIncome[k] ?? 0), 0) / sixKeys.length
      : 0

    // ── Category breakdown ────────────────────────────────────
    const curStart = startOf(curYear, curMonth)
    const curEnd = endOf(curYear, curMonth)
    const prevStart = startOf(prevYear, prevMonth)
    const prevEnd = endOf(prevYear, prevMonth)
    const sixStart = new Date(curYear, curMonth - 7, 1)

    const [curCat, prevCat, sixCat] = await Promise.all([
      this.catSummary(userId, curStart, curEnd),
      this.catSummary(userId, prevStart, prevEnd),
      this.catSummary(userId, sixStart, curStart),
    ])

    const catMap = new Map<string, { id: string; name: string; cur: number; prev: number; six: number }>()
    for (const [id, name, amount] of curCat) {
      catMap.set(id, { id, name, cur: amount, prev: 0, six: 0 })
    }
    for (const [id, name, amount] of prevCat) {
      const e = catMap.get(id) ?? { id, name, cur: 0, prev: 0, six: 0 }
      e.prev = amount
      catMap.set(id, e)
    }
    for (const [id, name, amount] of sixCat) {
      const e = catMap.get(id) ?? { id, name, cur: 0, prev: 0, six: 0 }
      // six months average (divide by months that actually had data, max 6)
      e.six = amount / Math.max(sixKeys.length, 1)
      catMap.set(id, e)
    }

    const categoryBreakdown: CategoryBreakdown[] = [...catMap.values()]
      .filter(c => c.cur > 0 || c.prev > 0)
      .map(c => {
        const trend: 'up' | 'down' | 'stable' =
          c.six === 0 ? 'stable'
          : c.cur > c.six * 1.1 ? 'up'
          : c.cur < c.six * 0.9 ? 'down'
          : 'stable'
        return {
          categoryId: c.id,
          categoryName: c.name,
          currentMonth: round2(c.cur),
          previousMonth: round2(c.prev),
          sixMonthAvg: round2(c.six),
          percentOfIncome: curIncome > 0 ? round2((c.cur / curIncome) * 100) : 0,
          trend,
        }
      })
      .sort((a, b) => b.currentMonth - a.currentMonth)
      .slice(0, 12)

    // ── Accounts ──────────────────────────────────────────────
    const accounts = await prisma.account.findMany({
      where: { userId },
      select: { name: true, balance: true },
    })

    // ── Existing goals ────────────────────────────────────────
    const goals = await this.goalRepo.findAllByUser(userId)
    const existingGoals = goals
      .filter(g => g.status === 'active')
      .map(g => ({ title: g.title, type: g.type, targetAmount: g.targetAmount }))

    // ── Recurring ─────────────────────────────────────────────
    const recurringExpenses = await this.recurringDetector.detect(userId)

    return {
      period: { current: currentKey, previous: previousKey },
      summary: {
        currentMonth: { income: round2(curIncome), expense: round2(curExpense), balance: round2(curIncome - curExpense) },
        previousMonth: { income: round2(prevIncome), expense: round2(prevExpense), balance: round2(prevIncome - prevExpense) },
        sixMonthAvgExpense: round2(sixMonthAvgExpense),
        sixMonthAvgIncome: round2(sixMonthAvgIncome),
      },
      categoryBreakdown,
      recurringExpenses,
      accounts: accounts.map(a => ({ name: a.name, balance: a.balance.toNumber() })),
      existingGoals,
      dataMonths: distinctMonths.size,
    }
  }

  private async catSummary(
    userId: string,
    start: Date,
    end: Date,
  ): Promise<[string, string, number][]> {
    const rows = await prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { userId, type: 'expense', date: { gte: start, lte: end }, categoryId: { not: null } },
      _sum: { amount: true },
    })
    const ids = rows.map(r => r.categoryId!).filter(Boolean)
    if (ids.length === 0) return []

    const cats = await prisma.category.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    const nameMap = new Map(cats.map(c => [c.id, c.name]))

    return rows.map(r => [
      r.categoryId!,
      nameMap.get(r.categoryId!) ?? 'Sem categoria',
      r._sum.amount?.toNumber() ?? 0,
    ])
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
