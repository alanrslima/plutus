import { ILoanRepository, CreateLoanData, InstallmentInput } from '../../../domain/repositories/ILoanRepository'
import { Loan, LoanStatus } from '../../../domain/entities/Loan'
import { LoanInstallment } from '../../../domain/entities/LoanInstallment'
import { prisma } from '../prisma'

function toLoan(raw: {
  id: string; userId: string; name: string; lender: string | null
  amountReceived: { toNumber: () => number }; totalAmount: { toNumber: () => number }
  installmentsCount: number; startDate: Date; firstDueDate: Date
  status: string; notes: string | null; createdAt: Date
}): Loan {
  return {
    id: raw.id,
    userId: raw.userId,
    name: raw.name,
    lender: raw.lender ?? undefined,
    amountReceived: raw.amountReceived.toNumber(),
    totalAmount: raw.totalAmount.toNumber(),
    installmentsCount: raw.installmentsCount,
    startDate: raw.startDate,
    firstDueDate: raw.firstDueDate,
    status: raw.status as LoanStatus,
    notes: raw.notes ?? undefined,
    createdAt: raw.createdAt,
  }
}

function toInstallment(raw: {
  id: string; loanId: string; number: number; dueDate: Date
  amount: { toNumber: () => number }; paid: boolean; paidAt: Date | null
}): LoanInstallment {
  return {
    id: raw.id,
    loanId: raw.loanId,
    number: raw.number,
    dueDate: raw.dueDate,
    amount: raw.amount.toNumber(),
    paid: raw.paid,
    paidAt: raw.paidAt ?? undefined,
  }
}

export class PrismaLoanRepository implements ILoanRepository {
  async findById(id: string, userId: string): Promise<Loan | null> {
    const loan = await prisma.loan.findFirst({ where: { id, userId } })
    return loan ? toLoan(loan) : null
  }

  async findAllByUser(userId: string): Promise<Loan[]> {
    const loans = await prisma.loan.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })
    return loans.map(toLoan)
  }

  async create(data: CreateLoanData, installments: InstallmentInput[]): Promise<Loan> {
    const loan = await prisma.loan.create({
      data: {
        userId: data.userId,
        name: data.name,
        lender: data.lender ?? null,
        amountReceived: data.amountReceived,
        totalAmount: data.totalAmount,
        installmentsCount: data.installmentsCount,
        startDate: data.startDate,
        firstDueDate: data.firstDueDate,
        status: data.status ?? 'active',
        notes: data.notes ?? null,
        installments: {
          create: installments.map(i => ({ number: i.number, dueDate: i.dueDate, amount: i.amount })),
        },
      },
    })
    return toLoan(loan)
  }

  async update(
    id: string,
    userId: string,
    data: Partial<Pick<Loan, 'name' | 'lender' | 'notes' | 'status'>>,
  ): Promise<Loan> {
    const loan = await prisma.loan.update({
      where: { id },
      data: {
        name: data.name,
        lender: data.lender,
        notes: data.notes,
        status: data.status,
      },
    })
    return toLoan(loan)
  }

  async delete(id: string, userId: string): Promise<void> {
    await prisma.loan.delete({ where: { id } })
  }

  async findInstallmentsByLoanId(loanId: string): Promise<LoanInstallment[]> {
    const installments = await prisma.loanInstallment.findMany({ where: { loanId }, orderBy: { number: 'asc' } })
    return installments.map(toInstallment)
  }

  async findInstallmentByIdForUser(installmentId: string, userId: string): Promise<LoanInstallment | null> {
    const installment = await prisma.loanInstallment.findFirst({
      where: { id: installmentId, loan: { userId } },
    })
    return installment ? toInstallment(installment) : null
  }

  async setInstallmentPaid(installmentId: string, paid: boolean): Promise<LoanInstallment> {
    const installment = await prisma.loanInstallment.update({
      where: { id: installmentId },
      data: { paid, paidAt: paid ? new Date() : null },
    })
    return toInstallment(installment)
  }
}
