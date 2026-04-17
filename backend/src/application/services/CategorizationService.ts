import { IAIProvider } from '../../domain/services/IAIProvider'
import { ParsedTransaction } from '../../domain/entities/ParsedTransaction'
import { Category } from '../../domain/entities/Category'
import { createLogger } from '../../infra/logger'

const log = createLogger('CategorizationService')

export class CategorizationService {
  constructor(
    private aiProvider: IAIProvider,
    private batchSize: number = 20,
  ) {}

  get isEnabled(): boolean {
    return this.aiProvider.name !== 'none'
  }

  async suggestCategories(
    transactions: ParsedTransaction[],
    categories: Category[],
  ): Promise<ParsedTransaction[]> {
    if (categories.length === 0 || !this.isEnabled) {
      log.debug(
        { isEnabled: this.isEnabled, categories: categories.length },
        'Skipping categorization',
      )
      return transactions
    }

    log.info(
      { provider: this.aiProvider.name, transactions: transactions.length, batchSize: this.batchSize },
      'Starting AI categorization',
    )

    const available = await this.aiProvider.isAvailable()
    if (!available) {
      log.warn({ provider: this.aiProvider.name }, 'Provider unavailable — skipping categorization')
      return transactions
    }

    const categoryOptions = categories
      .filter((c) => c.type !== 'transfer')
      .map((c) => ({ id: c.id, name: c.name, type: c.type }))

    if (categoryOptions.length === 0) {
      log.debug('No income/expense categories found — skipping categorization')
      return transactions
    }

    const suggestions = new Map<number, string | null>()
    const totalBatches = Math.ceil(transactions.length / this.batchSize)

    for (let start = 0; start < transactions.length; start += this.batchSize) {
      const batchIndex = Math.floor(start / this.batchSize) + 1
      const batch = transactions.slice(start, start + this.batchSize)

      log.debug(
        { batchIndex, totalBatches, batchSize: batch.length, startIndex: start },
        'Processing batch',
      )

      const toCategorizeBatch = batch.map((tx, i) => ({
        index: start + i,
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        date: tx.date instanceof Date ? tx.date.toISOString() : String(tx.date),
      }))

      try {
        const results = await this.aiProvider.categorize(toCategorizeBatch, categoryOptions)

        let matched = 0
        for (const result of results) {
          suggestions.set(result.index, result.categoryId)
          if (result.categoryId) matched++
        }

        log.debug(
          { batchIndex, totalBatches, matched, total: batch.length },
          'Batch processed',
        )
      } catch (err) {
        log.warn(
          { batchIndex, totalBatches, error: (err as Error).message },
          'Batch failed — continuing with remaining batches',
        )
      }
    }

    const enriched = transactions.map((tx, i) => {
      const categoryId = suggestions.get(i)
      return categoryId !== undefined ? { ...tx, suggestedCategoryId: categoryId } : tx
    })

    const totalMatched = [...suggestions.values()].filter(Boolean).length
    log.info(
      { provider: this.aiProvider.name, total: transactions.length, matched: totalMatched },
      'AI categorization complete',
    )

    return enriched
  }
}
