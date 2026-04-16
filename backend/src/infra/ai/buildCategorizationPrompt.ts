import {
  TransactionToCategorize,
  CategoryOption,
  CategorizationSuggestion,
} from '../../domain/services/IAIProvider'

export function buildSystemPrompt(): string {
  return `You are a financial transaction categorizer for a Brazilian personal finance app.
Your task is to assign each transaction to the best matching category.

Rules:
- Only assign a category whose "type" matches the transaction's "type" ("income" or "expense").
- Use the transaction description and amount as signals. Brazilian bank descriptions often contain merchant names, abbreviations, or codes (e.g. "IFOOD*", "UBER EATS", "PIX RECEBIDO", "SALARIO", "TED CREDIT").
- Prefer a specific category over a generic one. Use "Outros (Despesa)" or "Outros (Receita)" only when nothing fits.
- Never leave a transaction uncategorized unless the type has absolutely no matching category in the list.
- Respond ONLY with a JSON object in the exact format: {"results": [{"index": <number>, "categoryId": "<uuid>"}]}
- No explanation, no markdown, no extra text outside the JSON object.

Examples of common Brazilian transaction descriptions and their categories:
- "IFOOD", "RAPPI", "UBER EATS", "MC DONALDS", "SUBWAY" → Restaurante e Delivery
- "SUPERMERCADO", "MERCADO", "ATACADAO", "CARREFOUR", "EXTRA" → Supermercado
- "UBER", "99POP", "ONIBUS", "METRO", "COMBUSTIVEL", "POSTO" → Transporte or Combustível
- "NETFLIX", "SPOTIFY", "AMAZON PRIME", "DEEZER", "GLOBOPLAY" → Assinaturas e Streaming
- "FARMACIA", "DROGASIL", "DROGARIA" → Farmácia
- "ACADEMIA", "SMARTFIT", "BLUEFIT" → Academia e Esportes
- "SALARIO", "PAGAMENTO", "SALÁRIO" → Salário
- "PIX RECEBIDO", "TED CREDITO" → evaluate description context to pick income category
- "ENERGIA", "CEMIG", "LIGHT", "ENEL" → Energia Elétrica
- "AGUA", "SABESP", "COPASA" → Água e Saneamento`
}

export function buildUserPrompt(
  transactions: TransactionToCategorize[],
  categories: CategoryOption[]
): string {
  const categoryList = categories
    .map((c) => `  {"id": "${c.id}", "name": "${c.name}", "type": "${c.type}"}`)
    .join('\n')

  const txList = transactions
    .map((t) => `  {"index": ${t.index}, "description": "${t.description}", "amount": ${t.amount}, "type": "${t.type}"}`)
    .join('\n')

  return `Available categories:
[
${categoryList}
]

Transactions to categorize:
[
${txList}
]

Respond with a JSON object containing a "results" array. Every transaction must appear exactly once:
{"results": [{"index": 0, "categoryId": "<uuid>"}, ...]}`
}

export function parseCategorizationResponse(
  raw: string,
  categories: CategoryOption[]
): CategorizationSuggestion[] {
  try {
    const categoryIds = new Set(categories.map((c) => c.id))

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      // Try to extract JSON object or array from the string
      const objMatch = raw.match(/\{[\s\S]*\}/)
      const arrMatch = raw.match(/\[[\s\S]*\]/)
      if (objMatch) {
        parsed = JSON.parse(objMatch[0])
      } else if (arrMatch) {
        parsed = JSON.parse(arrMatch[0])
      } else {
        return []
      }
    }

    // Accept {"results": [...]} wrapper (preferred, for json_object mode)
    let items: unknown[]
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      Array.isArray((parsed as Record<string, unknown>).results)
    ) {
      items = (parsed as Record<string, unknown>).results as unknown[]
    } else if (Array.isArray(parsed)) {
      // Legacy: bare array
      items = parsed
    } else {
      return []
    }

    const results: CategorizationSuggestion[] = []

    for (const item of items) {
      if (typeof item !== 'object' || item === null) continue
      const entry = item as Record<string, unknown>
      if (typeof entry.index !== 'number') continue

      const categoryId =
        typeof entry.categoryId === 'string' && categoryIds.has(entry.categoryId)
          ? entry.categoryId
          : null

      results.push({ index: entry.index, categoryId })
    }

    return results
  } catch {
    return []
  }
}
