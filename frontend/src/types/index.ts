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
}

export interface ImportResult {
  importedCount: number
  skippedCount: number
  importHistory: ImportHistory
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
