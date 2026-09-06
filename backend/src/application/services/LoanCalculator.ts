export type GeneratedInstallment = { number: number; dueDate: Date; amount: number }

export function generateInstallments(totalAmount: number, count: number, firstDueDate: Date): GeneratedInstallment[] {
  const base = Math.floor((totalAmount / count) * 100) / 100
  const installments: GeneratedInstallment[] = []
  let accumulated = 0

  for (let i = 1; i <= count; i++) {
    const dueDate = new Date(firstDueDate)
    dueDate.setMonth(dueDate.getMonth() + (i - 1))
    const amount = i < count ? base : Math.round((totalAmount - accumulated) * 100) / 100
    accumulated += amount
    installments.push({ number: i, dueDate, amount })
  }

  return installments
}

/**
 * Solves for the monthly rate `i` in: principal = sum(amount_k / (1+i)^k)
 * via bisection — the NPV is monotonically decreasing in `i`, so a single
 * bracket [-0.9999, 10] always contains the root for positive cash flows.
 */
export function calculateMonthlyInterestRate(principal: number, installmentAmounts: number[]): number {
  if (principal <= 0 || installmentAmounts.length === 0) return 0

  const npv = (rate: number) =>
    installmentAmounts.reduce((sum, amount, idx) => sum + amount / Math.pow(1 + rate, idx + 1), -principal)

  let low = -0.9999
  let high = 10

  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2
    const value = npv(mid)
    if (Math.abs(value) < 1e-7) return mid
    if (value > 0) low = mid
    else high = mid
  }

  return (low + high) / 2
}

export function calculateAnnualInterestRate(monthlyRate: number): number {
  return Math.pow(1 + monthlyRate, 12) - 1
}

/**
 * Splits each installment into its interest and principal portions using the
 * declining-balance method: interest_k = balance_k * monthlyRate, principal_k = amount_k - interest_k.
 */
export function calculateInstallmentInterest<T extends { amount: number }>(
  amountReceived: number,
  installments: T[],
  monthlyInterestRate: number,
): (T & { interest: number; principal: number })[] {
  let balance = amountReceived

  return installments.map(installment => {
    const interest = Math.max(0, Math.round(balance * monthlyInterestRate * 100) / 100)
    const principal = installment.amount - interest
    balance -= principal
    return { ...installment, interest, principal }
  })
}

export type LoanStats = {
  totalInterest: number
  interestPercentage: number
  monthlyInterestRate: number
  annualInterestRate: number
  paidCount: number
  paidAmount: number
  remainingCount: number
  remainingAmount: number
}

export function calculateLoanStats(
  amountReceived: number,
  installments: { amount: number; paid: boolean }[],
): LoanStats {
  const totalAmount = installments.reduce((sum, i) => sum + i.amount, 0)
  const totalInterest = totalAmount - amountReceived
  const monthlyInterestRate = calculateMonthlyInterestRate(amountReceived, installments.map(i => i.amount))

  const paid = installments.filter(i => i.paid)
  const remaining = installments.filter(i => !i.paid)

  return {
    totalInterest,
    interestPercentage: amountReceived > 0 ? (totalInterest / amountReceived) * 100 : 0,
    monthlyInterestRate,
    annualInterestRate: calculateAnnualInterestRate(monthlyInterestRate),
    paidCount: paid.length,
    paidAmount: paid.reduce((sum, i) => sum + i.amount, 0),
    remainingCount: remaining.length,
    remainingAmount: remaining.reduce((sum, i) => sum + i.amount, 0),
  }
}
