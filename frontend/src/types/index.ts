export type TransactionType = 'income' | 'expense' | 'transfer'

export interface User {
  id: string
  name: string
  email: string
}

export interface Account {
  id: string
  userId: string
  name: string
  color?: string
  balance: number
  createdAt: string
}

export interface Category {
  id: string
  userId: string
  name: string
  type: TransactionType
  icon?: string
  color?: string
  createdAt: string
}

export interface Transaction {
  id: string
  userId: string
  accountId: string
  destinationAccountId?: string
  categoryId?: string
  categoryName?: string
  categoryIcon?: string
  categoryColor?: string
  type: TransactionType
  amount: number
  description?: string
  date: string
  createdAt: string
  installment?: number
  totalInstallments?: number
  parentTransactionId?: string
  referencedTransactionId?: string
  referencedTransaction?: { id: string; description?: string; amount: number; type: string }
  hasChildren?: boolean
}

export interface MonthlySummary {
  month: string
  totalIncome: number
  totalExpense: number
  balance: number
}

export interface CategorySummary {
  categoryId: string
  categoryName: string
  total: number
}

export interface AccountSummary {
  accountId: string
  accountName: string
  balance: number
}

export interface CategoryTrendItem {
  categoryId: string
  categoryName: string
  month: string
  total: number
}

export interface DailySummary {
  day: string
  totalIncome: number
  totalExpense: number
}

export interface CumulativeSummary {
  totalIncome: number
  totalExpense: number
  balance: number
}

export interface BalanceAsOfDate {
  balance: number
}

// Import
export type FileType = 'OFX' | 'CSV'
export type ImportStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED'

export interface ParsedTransaction {
  externalId: string
  date: string
  amount: number
  type: 'income' | 'expense'
  description: string
  category?: string
  suggestedCategoryId?: string | null
}

export interface ImportHistory {
  id: string
  userId: string
  accountId: string
  accountName?: string
  filename: string
  fileType: FileType
  status: ImportStatus
  importedCount: number
  skippedCount: number
  errorMessage?: string | null
  createdAt: string
}

export interface ImportPreviewResult {
  transactions: ParsedTransaction[]
  total: number
  fileType: FileType
  aiEnabled: boolean
  fileHash: string
}

export interface ImportResult {
  importedCount: number
  skippedCount: number
  importHistory: ImportHistory
}

export interface ImportedTransactionDetail {
  id: string
  description: string | null
  amount: number
  type: 'income' | 'expense' | 'transfer'
  date: string
  categoryName: string | null
  externalId: string | null
}

export interface ImportHistoryDetail extends ImportHistory {
  transactions: ImportedTransactionDetail[]
}

// Goals
export type GoalType = 'spending_limit' | 'savings_target'
export type GoalStatus = 'active' | 'achieved' | 'cancelled'

export interface Goal {
  id: string
  userId: string
  categoryId?: string
  title: string
  targetAmount: number
  currentAmount: number
  deadline?: string
  type: GoalType
  status: GoalStatus
  source: string
  createdAt: string
}

// Budgets
export interface Budget {
  id: string
  userId: string
  categoryId: string
  categoryName: string
  categoryIcon?: string
  categoryColor?: string
  amount: number
  month: number
  year: number
  spent: number
  remaining: number
  percentage: number
  createdAt: string
}

// Loans
export type LoanStatus = 'active' | 'paid' | 'cancelled'

export interface LoanInstallment {
  id: string
  loanId: string
  number: number
  dueDate: string
  amount: number
  paid: boolean
  paidAt?: string
}

export interface Loan {
  id: string
  userId: string
  name: string
  lender?: string
  amountReceived: number
  totalAmount: number
  installmentsCount: number
  startDate: string
  firstDueDate: string
  status: LoanStatus
  notes?: string
  createdAt: string
  installments: LoanInstallment[]
  totalInterest: number
  interestPercentage: number
  monthlyInterestRate: number
  annualInterestRate: number
  paidCount: number
  paidAmount: number
  remainingCount: number
  remainingAmount: number
}

// Copilot
export type InsightType =
  | 'overspending'
  | 'recurring_detected'
  | 'savings_opportunity'
  | 'positive_trend'
  | 'anomaly'
  | 'budget_at_risk'

export type ActionType = 'create_goal' | 'create_budget' | 'tag_subscription'

export interface CopilotInsight {
  id: string
  userId: string
  type: InsightType
  title: string
  body: string
  data?: Record<string, unknown>
  actionType?: ActionType
  actionPayload?: Record<string, unknown>
  actionTaken: boolean
  dismissed: boolean
  createdAt: string
  expiresAt?: string
}
