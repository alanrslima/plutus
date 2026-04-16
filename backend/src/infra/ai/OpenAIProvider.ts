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

const log = createLogger('OpenAIProvider')

export class OpenAIProvider implements IAIProvider {
  readonly name = 'openai'

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly timeoutMs: number,
  ) {
    log.info({ model }, 'OpenAIProvider initialized')
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
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.timeoutMs)

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0,
          max_tokens: 2048,
          response_format: { type: 'json_object' },
        }),
      })

      clearTimeout(timer)

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>
        usage?: { prompt_tokens: number; completion_tokens: number }
      }
      const rawContent: string = data.choices[0].message.content
      const durationMs = Date.now() - startMs

      log.debug(
        { rawContent, durationMs, usage: data.usage },
        'Raw response from OpenAI',
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
