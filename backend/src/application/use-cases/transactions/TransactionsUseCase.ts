import { ITransactionRepository, TransactionFilters } from '../../../domain/repositories/ITransactionRepository'
import { IAccountRepository } from '../../../domain/repositories/IAccountRepository'
import { Transaction } from '../../../domain/entities/Transaction'
import { TransactionType } from '../../../domain/entities/Category'

interface CreateTransactionInput {
  userId: string
  accountId: string
  destinationAccountId?: string
  categoryId?: string
  referencedTransactionId?: string
  type: TransactionType
  amount: number
  description?: string
  date: Date
  totalInstallments?: number
}

export class TransactionsUseCase {
  constructor(
    private transactionRepository: ITransactionRepository,
    private accountRepository: IAccountRepository,
  ) {}

  async list(userId: string, filters?: TransactionFilters): Promise<Transaction[]> {
    return this.transactionRepository.findAllByUser(userId, filters)
  }

  async create(input: CreateTransactionInput): Promise<Transaction[]> {
    const { userId, accountId, destinationAccountId, categoryId, referencedTransactionId, type, amount, description, date, totalInstallments } = input

    // Validate accounts belong to user
    const account = await this.accountRepository.findById(accountId, userId)
    if (!account) throw new Error('Account not found')

    if (type === 'transfer') {
      if (!destinationAccountId) throw new Error('Destination account required for transfers')
      const destAccount = await this.accountRepository.findById(destinationAccountId, userId)
      if (!destAccount) throw new Error('Destination account not found')
    }

    const installments = totalInstallments && totalInstallments > 1 ? totalInstallments : 1
    const baseAmount = installments > 1 ? Math.floor((amount / installments) * 100) / 100 : amount
    const lastAmount = installments > 1 ? Math.round((amount - baseAmount * (installments - 1)) * 100) / 100 : amount

    const buildInstallments = (overrides: Partial<Omit<Transaction, 'id' | 'createdAt'>> = {}) => {
      const result: Omit<Transaction, 'id' | 'createdAt'>[] = []
      for (let i = 0; i < installments; i++) {
        const installmentDate = new Date(date)
        if (i > 0) installmentDate.setMonth(installmentDate.getMonth() + i)

        const installmentAmount = i === installments - 1 ? lastAmount : baseAmount

        result.push({
          userId,
          accountId,
          destinationAccountId,
          categoryId,
          referencedTransactionId,
          type,
          amount: installmentAmount,
          description,
          date: installmentDate,
          installment: installments > 1 ? i + 1 : undefined,
          totalInstallments: installments > 1 ? installments : undefined,
          parentTransactionId: undefined, // set after first insert
          ...overrides,
        })
      }
      return result
    }

    // For transfer: debit + credit pair per installment
    if (type === 'transfer') {
      const installmentData = buildInstallments()
      const allTransactions: Omit<Transaction, 'id' | 'createdAt'>[] = []
      for (const t of installmentData) {
        allTransactions.push({ ...t, type: 'expense' })
        allTransactions.push({ ...t, accountId: destinationAccountId!, destinationAccountId: accountId, type: 'income' })
      }
      const created = await this.transactionRepository.createMany(allTransactions)
      for (const t of installmentData) {
        await this.accountRepository.updateBalance(accountId, -t.amount)
        await this.accountRepository.updateBalance(destinationAccountId!, t.amount)
      }
      return created
    }

    const installmentData = buildInstallments()

    if (installments === 1) {
      const created = await this.transactionRepository.createMany(installmentData)
      await this.accountRepository.updateBalance(accountId, type === 'income' ? installmentData[0].amount : -installmentData[0].amount)
      return created
    }

    // Insert first installment to obtain its real DB id, then link the rest
    const [first] = await this.transactionRepository.createMany([installmentData[0]])

    const remaining = installmentData.slice(1).map(t => ({
      ...t,
      parentTransactionId: first.id,
    }))
    const rest = await this.transactionRepository.createMany(remaining)

    // Update balance with full amount across all installments
    const totalDelta = installmentData.reduce((sum, t) => sum + t.amount, 0)
    await this.accountRepository.updateBalance(accountId, type === 'income' ? totalDelta : -totalDelta)

    return [first, ...rest]
  }

  async update(id: string, userId: string, data: Partial<Omit<Transaction, 'id' | 'userId' | 'createdAt'>>): Promise<Transaction> {
    const existing = await this.transactionRepository.findById(id, userId)
    if (!existing) throw new Error('Transaction not found')

    // Reverse old balance effect
    const oldDelta = existing.type === 'income' ? -existing.amount : existing.amount
    await this.accountRepository.updateBalance(existing.accountId, oldDelta)

    const updated = await this.transactionRepository.update(id, userId, data)

    // Apply new balance effect
    const newAmount = data.amount ?? existing.amount
    const newType = data.type ?? existing.type
    const newAccountId = data.accountId ?? existing.accountId
    const newDelta = newType === 'income' ? newAmount : -newAmount
    await this.accountRepository.updateBalance(newAccountId, newDelta)

    return updated
  }

  async delete(id: string, userId: string): Promise<void> {
    const existing = await this.transactionRepository.findById(id, userId)
    if (!existing) throw new Error('Transaction not found')

    const delta = existing.type === 'income' ? -existing.amount : existing.amount
    await this.accountRepository.updateBalance(existing.accountId, delta)

    if (existing.destinationAccountId) {
      const paired = await this.transactionRepository.findTransferPair(existing, userId)
      if (paired) {
        const pairedDelta = paired.type === 'income' ? -paired.amount : paired.amount
        await this.accountRepository.updateBalance(paired.accountId, pairedDelta)
        await this.transactionRepository.delete(paired.id, userId)
      }
    }

    await this.transactionRepository.delete(id, userId)
  }
}
