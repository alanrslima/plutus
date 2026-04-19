import {
  IAIProvider,
  TransactionToCategorize,
  CategoryOption,
  CategorizationSuggestion,
} from '../../domain/services/IAIProvider'

export class NullProvider implements IAIProvider {
  readonly name = 'none'

  async complete(_systemPrompt: string, _userPrompt: string, _onToken?: (token: string) => void): Promise<string> {
    throw new Error('No AI provider configured')
  }

  async categorize(
    _transactions: TransactionToCategorize[],
    _categories: CategoryOption[]
  ): Promise<CategorizationSuggestion[]> {
    return []
  }

  async isAvailable(): Promise<boolean> {
    return false
  }
}
