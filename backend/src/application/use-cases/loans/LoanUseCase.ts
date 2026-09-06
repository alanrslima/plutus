import { ILoanRepository } from '../../../domain/repositories/ILoanRepository'
import { Loan, LoanStatus } from '../../../domain/entities/Loan'
import { LoanInstallment } from '../../../domain/entities/LoanInstallment'
import { AppError } from '../../errors/AppError'
import {
  generateInstallments,
  calculateLoanStats,
  calculateInstallmentInterest,
  LoanStats,
} from '../../services/LoanCalculator'

export type CreateLoanInput = {
  name: string
  lender?: string
  amountReceived: number
  totalAmount: number
  installmentsCount: number
  startDate: Date
  firstDueDate: Date
  notes?: string
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
    if (input.totalAmount < input.amountReceived) {
      throw new AppError('O valor total a pagar não pode ser menor que o valor recebido', 400)
    }
    if (input.installmentsCount < 1) throw new AppError('O número de parcelas deve ser pelo menos 1', 400)

    const installments = generateInstallments(input.totalAmount, input.installmentsCount, input.firstDueDate)

    const loan = await this.loanRepo.create(
      {
        userId,
        name: input.name,
        lender: input.lender,
        amountReceived: input.amountReceived,
        totalAmount: input.totalAmount,
        installmentsCount: input.installmentsCount,
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
