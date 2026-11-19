export type LoanStatus = 'active' | 'paid' | 'cancelled'

/** fixed: equal installments from a known total · sac: constant amortization · price: constant installment (French table) */
export type AmortizationType = 'fixed' | 'sac' | 'price'

export type Loan = {
  id: string
  userId: string
  name: string
  lender?: string
  amountReceived: number
  totalAmount: number
  installmentsCount: number
  amortizationType: AmortizationType
  /** Contractual monthly rate as a fraction (0.01 = 1% a.m.). Only set for sac/price. */
  interestRate?: number
  startDate: Date
  firstDueDate: Date
  status: LoanStatus
  notes?: string
  createdAt: Date
}
