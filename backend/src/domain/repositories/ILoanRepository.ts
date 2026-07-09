import { Loan, LoanStatus } from '../entities/Loan'
import { LoanInstallment } from '../entities/LoanInstallment'

export type CreateLoanData = Omit<Loan, 'id' | 'createdAt' | 'status'> & { status?: LoanStatus }
export type InstallmentInput = { number: number; dueDate: Date; amount: number }

export interface ILoanRepository {
  findById(id: string, userId: string): Promise<Loan | null>
  findAllByUser(userId: string): Promise<Loan[]>
  create(data: CreateLoanData, installments: InstallmentInput[]): Promise<Loan>
  update(id: string, userId: string, data: Partial<Pick<Loan, 'name' | 'lender' | 'notes' | 'status'>>): Promise<Loan>
  delete(id: string, userId: string): Promise<void>

  findInstallmentsByLoanId(loanId: string): Promise<LoanInstallment[]>
  findInstallmentByIdForUser(installmentId: string, userId: string): Promise<LoanInstallment | null>
  setInstallmentPaid(installmentId: string, paid: boolean): Promise<LoanInstallment>
}
