import { ITransactionRepository, TransactionFilters } from '../../../domain/repositories/ITransactionRepository'
import { Transaction } from '../../../domain/entities/Transaction'
import { TransactionType } from '../../../domain/entities/Category'
import { prisma } from '../prisma'
import { Prisma } from '@prisma/client'

type RawTransaction = {
  id: string; userId: string; accountId: string; destinationAccountId: string | null
  categoryId: string | null; type: string; amount: { toNumber: () => number }; description: string | null
  date: Date; createdAt: Date; installment: number | null; totalInstallments: number | null
  parentTransactionId: string | null; referencedTransactionId: string | null
  category?: { name: string; icon: string | null; color: string | null } | null
  referencedTransaction?: { id: string; description: string | null; amount: { toNumber: () => number }; type: string } | null
  childTransactions?: { id: string }[]
}

function toTransaction(raw: RawTransaction): Transaction {
  return {
    id: raw.id,
    userId: raw.userId,
    accountId: raw.accountId,
    destinationAccountId: raw.destinationAccountId ?? undefined,
    categoryId: raw.categoryId ?? undefined,
    categoryName: raw.category?.name ?? undefined,
    categoryIcon: raw.category?.icon ?? undefined,
    categoryColor: raw.category?.color ?? undefined,
    type: raw.type as TransactionType,
    amount: raw.amount.toNumber(),
    description: raw.description ?? undefined,
    date: raw.date,
    createdAt: raw.createdAt,
    installment: raw.installment ?? undefined,
    totalInstallments: raw.totalInstallments ?? undefined,
    parentTransactionId: raw.parentTransactionId ?? undefined,
    referencedTransactionId: raw.referencedTransactionId ?? undefined,
    referencedTransaction: raw.referencedTransaction
      ? {
          id: raw.referencedTransaction.id,
          description: raw.referencedTransaction.description ?? undefined,
          amount: raw.referencedTransaction.amount.toNumber(),
          type: raw.referencedTransaction.type,
        }
      : undefined,
    hasChildren: (raw.childTransactions?.length ?? 0) > 0,
  }
}

const categoryInclude = {
  category: { select: { name: true, icon: true, color: true } },
  referencedTransaction: { select: { id: true, description: true, amount: true, type: true } },
  childTransactions: { select: { id: true } },
} as const

export class PrismaTransactionRepository implements ITransactionRepository {
  async findById(id: string, userId: string): Promise<Transaction | null> {
    const t = await prisma.transaction.findFirst({ where: { id, userId }, include: categoryInclude })
    return t ? toTransaction(t) : null
  }

  async findAllByUser(userId: string, filters?: TransactionFilters): Promise<Transaction[]> {
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        // Only show the expense leg of transfers (income leg is the internal mirror)
        NOT: { AND: [{ type: 'income' }, { destinationAccountId: { not: null } }] },
        // type filter: 'transfer' means expense leg with a destinationAccountId
        ...(filters?.type === 'transfer'
          ? { destinationAccountId: { not: null } }
          : filters?.type
            ? { type: filters.type, destinationAccountId: null }
            : {}),
        ...(filters?.accountId ? { accountId: filters.accountId } : {}),
        ...(filters?.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(filters?.startDate || filters?.endDate ? {
          date: {
            ...(filters?.startDate ? { gte: filters.startDate } : {}),
            ...(filters?.endDate ? { lte: filters.endDate } : {}),
          }
        } : {}),
      },
      include: categoryInclude,
      orderBy: { date: 'desc' },
    })
    return transactions.map(toTransaction)
  }

  async findTransferPair(t: Transaction, userId: string): Promise<Transaction | null> {
    const pairedType = t.type === 'expense' ? 'income' : 'expense'
    const paired = await prisma.transaction.findFirst({
      where: {
        userId,
        type: pairedType,
        accountId: t.destinationAccountId,
        destinationAccountId: t.accountId,
        date: t.date,
      },
      include: categoryInclude,
    })
    return paired ? toTransaction(paired) : null
  }

  async createMany(data: Omit<Transaction, 'id' | 'createdAt'>[]): Promise<Transaction[]> {
    const created = await prisma.$transaction(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      data.map(({ referencedTransaction, ...t }) => prisma.transaction.create({ data: t, include: categoryInclude }))
    )
    return created.map(toTransaction)
  }

  async update(id: string, userId: string, data: Partial<Omit<Transaction, 'id' | 'userId' | 'createdAt'>>): Promise<Transaction> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { referencedTransaction, ...prismaData } = data
    const updated = await prisma.transaction.update({ where: { id }, data: prismaData as Parameters<typeof prisma.transaction.update>[0]['data'], include: categoryInclude })
    return toTransaction(updated)
  }

  async delete(id: string, userId: string): Promise<void> {
    await prisma.transaction.delete({ where: { id } })
  }

  async deleteByParentId(parentTransactionId: string, userId: string): Promise<void> {
    await prisma.transaction.deleteMany({ where: { parentTransactionId, userId } })
  }

  async getMonthlySummary(userId: string, year: number, month?: number): Promise<{ month: string; totalIncome: number; totalExpense: number; balance: number }[]> {
    const monthFilter = month != null ? Prisma.sql`AND EXTRACT(MONTH FROM date) = ${month}` : Prisma.empty

    const result = await prisma.$queryRaw<{ month: string; totalIncome: number; totalExpense: number }[]>`
      SELECT
        TO_CHAR(date, 'YYYY-MM') as month,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as "totalIncome",
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as "totalExpense"
      FROM transactions
      WHERE user_id = ${userId}
        AND EXTRACT(YEAR FROM date) = ${year}
        AND destination_account_id IS NULL
        ${monthFilter}
      GROUP BY TO_CHAR(date, 'YYYY-MM')
      ORDER BY month ASC
    `
    return result.map(r => ({
      month: r.month,
      totalIncome: Number(r.totalIncome),
      totalExpense: Number(r.totalExpense),
      balance: Number(r.totalIncome) - Number(r.totalExpense),
    }))
  }

  async getCategorySummary(userId: string, startDate?: Date, endDate?: Date): Promise<{ categoryId: string; categoryName: string; total: number }[]> {
    const startFilter = startDate ? Prisma.sql`AND t.date >= ${startDate}` : Prisma.empty
    const endFilter = endDate ? Prisma.sql`AND t.date <= ${endDate}` : Prisma.empty

    const result = await prisma.$queryRaw<{ categoryId: string; categoryName: string; total: number }[]>`
      SELECT
        c.id as "categoryId",
        c.name as "categoryName",
        COALESCE(SUM(t.amount), 0) as total
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ${userId}
        AND t.type = 'expense'
        AND t.destination_account_id IS NULL
        ${startFilter}
        ${endFilter}
      GROUP BY c.id, c.name
      ORDER BY total DESC
    `
    return result.map(r => ({
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      total: Number(r.total),
    }))
  }

  async getAccountSummary(userId: string): Promise<{ accountId: string; accountName: string; balance: number }[]> {
    const accounts = await prisma.account.findMany({
      where: { userId },
      select: { id: true, name: true, balance: true },
      orderBy: { name: 'asc' },
    })
    return accounts.map(a => ({
      accountId: a.id,
      accountName: a.name,
      balance: a.balance.toNumber(),
    }))
  }
}
