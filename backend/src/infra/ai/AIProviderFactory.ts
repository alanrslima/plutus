import { IAIProvider } from '../../domain/services/IAIProvider'
import { NullProvider } from './NullProvider'
import { OllamaProvider } from './OllamaProvider'
import { OpenAIProvider } from './OpenAIProvider'
import { AnthropicProvider } from './AnthropicProvider'
import { createLogger } from '../logger'

const log = createLogger('AIProviderFactory')

export class AIProviderFactory {
  static create(): IAIProvider {
    const provider = process.env.AI_PROVIDER?.toLowerCase()
    const timeoutMs = parseInt(process.env.AI_TIMEOUT_MS ?? '30000', 10)

    log.info({ provider: provider ?? 'none', timeoutMs }, 'Creating AI provider')

    switch (provider) {
      case 'ollama':
        return new OllamaProvider(
          process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
          process.env.OLLAMA_MODEL ?? 'llama3.2',
          timeoutMs,
        )
      case 'openai':
        return new OpenAIProvider(
          process.env.OPENAI_API_KEY ?? '',
          process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
          timeoutMs,
        )
      case 'anthropic':
        return new AnthropicProvider(
          process.env.ANTHROPIC_API_KEY ?? '',
          process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
          timeoutMs,
        )
      default:
        log.info('No AI provider configured — categorization disabled')
        return new NullProvider()
    }
  }
}
