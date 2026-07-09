export type LoanStatus = 'active' | 'paid' | 'cancelled'

export type Loan = {
  id: string
  userId: string
  name: string
  lender?: string
  amountReceived: number
  totalAmount: number
  installmentsCount: number
  startDate: Date
  firstDueDate: Date
  status: LoanStatus
  notes?: string
  createdAt: Date
}
