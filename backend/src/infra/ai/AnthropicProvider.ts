import Anthropic from '@anthropic-ai/sdk'
import {
  IAIProvider,
  TransactionToCategorize,
  CategoryOption,
  CategorizationSuggestion,
} from '../../domain/services/IAIProvider'
import {
  buildSystemPrompt,
  buildUserPrompt,
  parseCategorizationResponse,
} from './buildCategorizationPrompt'
import { createLogger } from '../logger'

const log = createLogger('AnthropicProvider')

export class AnthropicProvider implements IAIProvider {
  readonly name = 'anthropic'

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly timeoutMs: number,
  ) {
    log.info({ model }, 'AnthropicProvider initialized')
  }

  async isAvailable(): Promise<boolean> {
    const available = this.apiKey.length > 0
    log.debug({ available }, 'isAvailable check (key presence)')
    return available
  }

  async categorize(
    transactions: TransactionToCategorize[],
    categories: CategoryOption[],
  ): Promise<CategorizationSuggestion[]> {
    const startMs = Date.now()
    const systemPrompt = buildSystemPrompt()
    const userPrompt = buildUserPrompt(transactions, categories)

    log.debug(
      { model: this.model, transactions: transactions.length, categories: categories.length },
      'Sending categorization request',
    )
    log.debug({ systemPrompt }, 'System prompt')
    log.debug({ userPrompt }, 'User prompt')

    try {
      const client = new Anthropic({
        apiKey: this.apiKey,
        timeout: this.timeoutMs,
      })

      const response = await client.messages.create({
        model: this.model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      })

      const block = response.content[0]
      if (block.type !== 'text') {
        log.warn({ blockType: block.type }, 'Unexpected response block type from Anthropic')
        return []
      }

      const rawContent = block.text
      const durationMs = Date.now() - startMs

      log.debug(
        { rawContent, durationMs, usage: response.usage },
        'Raw response from Anthropic',
      )

      const suggestions = parseCategorizationResponse(rawContent, categories)

      log.debug(
        { suggestions, durationMs, matched: suggestions.filter((s) => s.categoryId).length },
        'Categorization complete',
      )

      return suggestions
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err))
      const durationMs = Date.now() - startMs
      log.warn({ error: error.message, durationMs, model: this.model }, 'Categorization request failed')
      return []
    }
  }
}
