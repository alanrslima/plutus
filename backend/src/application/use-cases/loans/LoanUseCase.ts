import { ILoanRepository } from '../../../domain/repositories/ILoanRepository'
import { Loan, LoanStatus, AmortizationType } from '../../../domain/entities/Loan'
import { LoanInstallment } from '../../../domain/entities/LoanInstallment'
import { AppError } from '../../errors/AppError'
import {
  generateInstallments,
  generateSacInstallments,
  generatePriceInstallments,
  GeneratedInstallment,
  calculateLoanStats,
  calculateInstallmentInterest,
  LoanStats,
} from '../../services/LoanCalculator'

type CreateLoanBase = {
  name: string
  lender?: string
  amountReceived: number
  installmentsCount: number
  startDate: Date
  firstDueDate: Date
  notes?: string
}

/**
 * fixed: the user knows the total to pay and installments are split evenly.
 * sac/price: the user knows the contractual monthly rate (fraction) and the schedule is computed.
 */
export type CreateLoanInput =
  | (CreateLoanBase & { amortizationType: 'fixed'; totalAmount: number })
  | (CreateLoanBase & { amortizationType: Exclude<AmortizationType, 'fixed'>; interestRate: number })

export type UpdateInstallmentInput = {
  amount?: number
  dueDate?: Date
}

export type UpdateLoanInput = {
  name?: string
  lender?: string
  notes?: string
  status?: LoanStatus
}

export type LoanInstallmentDetail = LoanInstallment & { interest: number; principal: number }

export type LoanDetail = Loan & { installments: LoanInstallmentDetail[] } & LoanStats

export class LoanUseCase {
  constructor(private loanRepo: ILoanRepository) {}

  async list(userId: string): Promise<LoanDetail[]> {
    const loans = await this.loanRepo.findAllByUser(userId)
    return Promise.all(loans.map(loan => this.assembleDetail(loan)))
  }

  async getById(id: string, userId: string): Promise<LoanDetail> {
    const loan = await this.loanRepo.findById(id, userId)
    if (!loan) throw new AppError('Empréstimo não encontrado', 404)
    return this.assembleDetail(loan)
  }

  async create(userId: string, input: CreateLoanInput): Promise<LoanDetail> {
    if (input.amountReceived <= 0) throw new AppError('O valor recebido deve ser maior que zero', 400)
    if (input.installmentsCount < 1) throw new AppError('O número de parcelas deve ser pelo menos 1', 400)

    let installments: GeneratedInstallment[]
    let interestRate: number | undefined

    if (input.amortizationType === 'fixed') {
      if (input.totalAmount < input.amountReceived) {
        throw new AppError('O valor total a pagar não pode ser menor que o valor recebido', 400)
      }
      installments = generateInstallments(input.totalAmount, input.installmentsCount, input.firstDueDate)
    } else {
      if (input.interestRate < 0) throw new AppError('A taxa de juros não pode ser negativa', 400)
      interestRate = input.interestRate
      const generate = input.amortizationType === 'sac' ? generateSacInstallments : generatePriceInstallments
      installments = generate(input.amountReceived, input.interestRate, input.installmentsCount, input.firstDueDate)
    }

    const loan = await this.loanRepo.create(
      {
        userId,
        name: input.name,
        lender: input.lender,
        amountReceived: input.amountReceived,
        totalAmount: sumAmounts(installments),
        installmentsCount: input.installmentsCount,
        amortizationType: input.amortizationType,
        interestRate,
        startDate: input.startDate,
        firstDueDate: input.firstDueDate,
        notes: input.notes,
      },
      installments,
    )

    return this.assembleDetail(loan)
  }

  async update(id: string, userId: string, input: UpdateLoanInput): Promise<LoanDetail> {
    const loan = await this.loanRepo.findById(id, userId)
    if (!loan) throw new AppError('Empréstimo não encontrado', 404)

    const updated = await this.loanRepo.update(id, userId, input)
    return this.assembleDetail(updated)
  }

  async delete(id: string, userId: string): Promise<void> {
    const loan = await this.loanRepo.findById(id, userId)
    if (!loan) throw new AppError('Empréstimo não encontrado', 404)
    await this.loanRepo.delete(id, userId)
  }

  async payInstallment(installmentId: string, userId: string): Promise<LoanDetail> {
    return this.setInstallmentPaid(installmentId, userId, true)
  }

  async unpayInstallment(installmentId: string, userId: string): Promise<LoanDetail> {
    return this.setInstallmentPaid(installmentId, userId, false)
  }

  /**
   * Adjusts a single installment (e.g. to match the real bill, which may include insurance,
   * fees or monetary correction). The loan total is kept in sync with the sum of installments;
   * the effective rate and interest split are recomputed from the actual amounts on read.
   */
  async updateInstallment(installmentId: string, userId: string, input: UpdateInstallmentInput): Promise<LoanDetail> {
    if (input.amount === undefined && input.dueDate === undefined) {
      throw new AppError('Informe o valor ou o vencimento da parcela', 400)
    }
    if (input.amount !== undefined && input.amount <= 0) {
      throw new AppError('O valor da parcela deve ser maior que zero', 400)
    }

    const installment = await this.loanRepo.findInstallmentByIdForUser(installmentId, userId)
    if (!installment) throw new AppError('Parcela não encontrada', 404)

    await this.loanRepo.updateInstallment(installmentId, input)

    const installments = await this.loanRepo.findInstallmentsByLoanId(installment.loanId)
    const loan = await this.loanRepo.update(installment.loanId, userId, { totalAmount: sumAmounts(installments) })

    return this.assembleDetail(loan, installments)
  }

  private async setInstallmentPaid(installmentId: string, userId: string, paid: boolean): Promise<LoanDetail> {
    const installment = await this.loanRepo.findInstallmentByIdForUser(installmentId, userId)
    if (!installment) throw new AppError('Parcela não encontrada', 404)

    await this.loanRepo.setInstallmentPaid(installmentId, paid)

    const loan = await this.loanRepo.findById(installment.loanId, userId)
    if (!loan) throw new AppError('Empréstimo não encontrado', 404)

    const installments = await this.loanRepo.findInstallmentsByLoanId(loan.id)
    const allPaid = installments.every(i => i.paid)

    let finalLoan = loan
    if (allPaid && loan.status !== 'paid') {
      finalLoan = await this.loanRepo.update(loan.id, userId, { status: 'paid' })
    } else if (!allPaid && loan.status === 'paid') {
      finalLoan = await this.loanRepo.update(loan.id, userId, { status: 'active' })
    }

    return this.assembleDetail(finalLoan, installments)
  }

  private async assembleDetail(loan: Loan, installments?: LoanInstallment[]): Promise<LoanDetail> {
    const loanInstallments = installments ?? (await this.loanRepo.findInstallmentsByLoanId(loan.id))
    const stats = calculateLoanStats(loan.amountReceived, loanInstallments)
    const installmentsWithInterest = calculateInstallmentInterest(
      loan.amountReceived,
      loanInstallments,
      stats.monthlyInterestRate,
    )
    return { ...loan, installments: installmentsWithInterest, ...stats }
  }
}

function sumAmounts(installments: { amount: number }[]): number {
  return Math.round(installments.reduce((sum, i) => sum + i.amount, 0) * 100) / 100
}
