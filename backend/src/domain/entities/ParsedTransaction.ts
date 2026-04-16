export type ParsedTransactionType = 'income' | 'expense'

export interface ParsedTransaction {
  externalId: string        // FITID from OFX, or generated hash for CSV
  date: Date
  amount: number            // always positive
  type: ParsedTransactionType  // 'income' for credit, 'expense' for debit
  description: string
  category?: string         // optional category hint from OFX
}
