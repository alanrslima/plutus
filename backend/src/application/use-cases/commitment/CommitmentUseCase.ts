import { ITransactionRepository } from '../../../domain/repositories/ITransactionRepository'
import { ILoanRepository } from '../../../domain/repositories/ILoanRepository'
import { AppError } from '../../errors/AppError'

export type CommitmentSource = 'installment' | 'expense' | 'loan'

export type CommitmentItem = {
  id: string
  source: CommitmentSource
  description: string
  amount: number
  date: Date
  installment?: number
  totalInstallments?: number
  categoryName?: string
  categoryColor?: string
  paid?: boolean
}

export type CommitmentMonth = {
  month: string // YYYY-MM
  scheduledIncome: number
  income: number // income considered for the percentage: max(scheduled, reference)
  installmentExpenses: number
  otherExpenses: number
  loanInstallments: number
  totalCommitted: number
  free: number
  percentage: number // 0..100+ (null-safe: 0 when there is no income)
  items: CommitmentItem[]
}

export type CommitmentReport = {
  referenceIncome: number
  referenceMonths: number
  months: CommitmentMonth[]
  lastCommitmentMonth: string | null // last month in the window with installments or loan payments
}

const REFERENCE_MONTHS = 3
const MAX_MONTHS = 36

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7)
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export class CommitmentUseCase {
  constructor(
    private transactionRepository: ITransactionRepository,
    private loanRepository: ILoanRepository,
  ) {}

  async getCommitment(userId: string, months: number, now: Date = new Date()): Promise<CommitmentReport> {
    if (!Number.isInteger(months) || months < 1 || months > MAX_MONTHS) {
      throw new AppError(`O horizonte deve ser entre 1 e ${MAX_MONTHS} meses`, 400)
    }

    const year = now.getUTCFullYear()
    const month = now.getUTCMonth()
    const windowStart = new Date(Date.UTC(year, month, 1))
    const windowEnd = new Date(Date.UTC(year, month + months, 1))
    const referenceStart = new Date(Date.UTC(year, month - REFERENCE_MONTHS, 1))
    const currentKey = monthKey(windowStart)

    const [pastIncome, futureIncome, futureExpenses, loanInstallments] = await Promise.all([
      this.transactionRepository.findAllByUser(userId, {
        type: 'income',
        startDate: referenceStart,
        endDate: new Date(windowStart.getTime() - 1),
      }),
      this.transactionRepository.findAllByUser(userId, {
        type: 'income',
        startDate: windowStart,
        endDate: new Date(windowEnd.getTime() - 1),
      }),
      this.transactionRepository.findAllByUser(userId, {
        type: 'expense',
        startDate: windowStart,
        endDate: new Date(windowEnd.getTime() - 1),
      }),
      this.loanRepository.findInstallmentsByUserInRange(userId, windowStart, windowEnd),
    ])

    // Reference income: average of the last full months that had any income
    const incomeByPastMonth = new Map<string, number>()
    for (const t of pastIncome) {
      const key = monthKey(t.date)
      incomeByPastMonth.set(key, (incomeByPastMonth.get(key) ?? 0) + t.amount)
    }
    const pastTotals = [...incomeByPastMonth.values()]
    const referenceIncome = pastTotals.length
      ? round2(pastTotals.reduce((a, b) => a + b, 0) / pastTotals.length)
      : 0

    const buckets = new Map<string, CommitmentMonth>()
    for (let i = 0; i < months; i++) {
      const key = monthKey(new Date(Date.UTC(year, month + i, 1)))
      buckets.set(key, {
        month: key,
        scheduledIncome: 0,
        income: 0,
        installmentExpenses: 0,
        otherExpenses: 0,
        loanInstallments: 0,
        totalCommitted: 0,
        free: 0,
        percentage: 0,
        items: [],
      })
    }

    for (const t of futureIncome) {
      const bucket = buckets.get(monthKey(t.date))
      if (bucket) bucket.scheduledIncome += t.amount
    }

    for (const t of futureExpenses) {
      const bucket = buckets.get(monthKey(t.date))
      if (!bucket) continue
      const isInstallment = (t.totalInstallments ?? 0) > 1
      if (isInstallment) bucket.installmentExpenses += t.amount
      else bucket.otherExpenses += t.amount
      bucket.items.push({
        id: t.id,
        source: isInstallment ? 'installment' : 'expense',
        description: t.description ?? t.categoryName ?? 'Despesa',
        amount: t.amount,
        date: t.date,
        installment: t.installment,
        totalInstallments: t.totalInstallments,
        categoryName: t.categoryName,
        categoryColor: t.categoryColor,
      })
    }

    for (const inst of loanInstallments) {
      const key = monthKey(inst.dueDate)
      const bucket = buckets.get(key)
      if (!bucket) continue
      // A future installment already paid in advance no longer commits that month's income
      if (inst.paid && key !== currentKey) continue
      bucket.loanInstallments += inst.amount
      bucket.items.push({
        id: inst.id,
        source: 'loan',
        description: inst.loanName,
        amount: inst.amount,
        date: inst.dueDate,
        installment: inst.number,
        totalInstallments: inst.installmentsCount,
        paid: inst.paid,
      })
    }

    let lastCommitmentMonth: string | null = null
    const result: CommitmentMonth[] = []
    for (const bucket of buckets.values()) {
      bucket.scheduledIncome = round2(bucket.scheduledIncome)
      bucket.installmentExpenses = round2(bucket.installmentExpenses)
      bucket.otherExpenses = round2(bucket.otherExpenses)
      bucket.loanInstallments = round2(bucket.loanInstallments)
      bucket.totalCommitted = round2(bucket.installmentExpenses + bucket.otherExpenses + bucket.loanInstallments)
      bucket.income = Math.max(bucket.scheduledIncome, referenceIncome)
      bucket.free = round2(bucket.income - bucket.totalCommitted)
      bucket.percentage = bucket.income > 0 ? round2((bucket.totalCommitted / bucket.income) * 100) : 0
      bucket.items.sort((a, b) => b.amount - a.amount)
      if (bucket.installmentExpenses > 0 || bucket.loanInstallments > 0) lastCommitmentMonth = bucket.month
      result.push(bucket)
    }

    return { referenceIncome, referenceMonths: REFERENCE_MONTHS, months: result, lastCommitmentMonth }
  }
}
