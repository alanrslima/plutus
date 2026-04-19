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

const log = createLogger('OllamaProvider')

export class OllamaProvider implements IAIProvider {
  readonly name = 'ollama'

  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly timeoutMs: number,
  ) {
    log.info({ baseUrl, model, timeoutMs }, 'OllamaProvider initialized')
  }

  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5_000)
      const response = await fetch(`${this.baseUrl}/api/tags`, { signal: controller.signal })
      clearTimeout(timer)
      const available = response.status === 200
      log.debug({ available, baseUrl: this.baseUrl }, 'isAvailable check')
      return available
    } catch (err) {
      log.warn({ err: (err as Error).message, baseUrl: this.baseUrl }, 'isAvailable check failed — Ollama unreachable')
      return false
    }
  }

  async complete(systemPrompt: string, userPrompt: string, onToken?: (token: string) => void): Promise<string> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        stream: false,
      }),
    })
    clearTimeout(timer)
    const data = await response.json() as { message: { content: string } }
    const text = data.message.content
    onToken?.(text)
    return text
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

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          stream: false,
          format: 'json',
        }),
      })

      clearTimeout(timer)

      const data = (await response.json()) as { message: { content: string } }
      const rawContent: string = data.message.content
      const durationMs = Date.now() - startMs

      log.debug({ rawContent, durationMs }, 'Raw response from Ollama')

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
