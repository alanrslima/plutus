export type LoanInstallment = {
  id: string
  loanId: string
  number: number
  dueDate: Date
  amount: number
  paid: boolean
  paidAt?: Date
}
