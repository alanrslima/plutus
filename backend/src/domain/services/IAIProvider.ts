export interface TransactionToCategorize {
  index: number
  description: string
  amount: number
  type: 'income' | 'expense'
  /** ISO date string, used to extract day-of-month/week signals */
  date?: string
}

export interface CategoryOption {
  id: string
  name: string
  type: 'income' | 'expense' | 'transfer'
}

export interface CategorizationSuggestion {
  index: number
  categoryId: string | null
}

export interface IAIProvider {
  categorize(
    transactions: TransactionToCategorize[],
    categories: CategoryOption[]
  ): Promise<CategorizationSuggestion[]>
  complete(
    systemPrompt: string,
    userPrompt: string,
    onToken?: (token: string) => void,
  ): Promise<string>
  isAvailable(): Promise<boolean>
  readonly name: string
}
