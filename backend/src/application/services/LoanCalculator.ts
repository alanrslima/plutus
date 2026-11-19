export type GeneratedInstallment = { number: number; dueDate: Date; amount: number }

const round2 = (value: number) => Math.round(value * 100) / 100

function dueDateFor(firstDueDate: Date, number: number): Date {
  const dueDate = new Date(firstDueDate)
  dueDate.setMonth(dueDate.getMonth() + (number - 1))
  return dueDate
}

export function generateInstallments(totalAmount: number, count: number, firstDueDate: Date): GeneratedInstallment[] {
  const base = Math.floor((totalAmount / count) * 100) / 100
  const installments: GeneratedInstallment[] = []
  let accumulated = 0

  for (let i = 1; i <= count; i++) {
    const amount = i < count ? base : round2(totalAmount - accumulated)
    accumulated += amount
    installments.push({ number: i, dueDate: dueDateFor(firstDueDate, i), amount })
  }

  return installments
}

/**
 * SAC (Sistema de Amortização Constante): amortization is fixed at principal / n and
 * interest is charged on the outstanding balance, so installments decrease over time.
 * The last installment amortizes whatever balance is left, absorbing rounding.
 */
export function generateSacInstallments(
  principal: number,
  monthlyRate: number,
  count: number,
  firstDueDate: Date,
): GeneratedInstallment[] {
  const amortization = Math.floor((principal / count) * 100) / 100
  const installments: GeneratedInstallment[] = []
  let balance = principal

  for (let i = 1; i <= count; i++) {
    const interest = round2(balance * monthlyRate)
    const principalPart = i < count ? amortization : round2(balance)
    balance = round2(balance - principalPart)
    installments.push({ number: i, dueDate: dueDateFor(firstDueDate, i), amount: round2(principalPart + interest) })
  }

  return installments
}

/**
 * Price (Tabela Price / French amortization): constant installment
 * PMT = P·i / (1 − (1+i)^−n). Interest on the outstanding balance shrinks while the
 * amortization grows. The last installment pays off the remaining balance exactly.
 */
export function generatePriceInstallments(
  principal: number,
  monthlyRate: number,
  count: number,
  firstDueDate: Date,
): GeneratedInstallment[] {
  if (monthlyRate === 0) return generateInstallments(principal, count, firstDueDate)

  const pmt = round2((principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -count)))
  const installments: GeneratedInstallment[] = []
  let balance = principal

  for (let i = 1; i <= count; i++) {
    const interest = round2(balance * monthlyRate)
    const amount = i < count ? pmt : round2(balance + interest)
    balance = round2(balance - (amount - interest))
    installments.push({ number: i, dueDate: dueDateFor(firstDueDate, i), amount })
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
