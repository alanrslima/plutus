import {
  TransactionToCategorize,
  CategoryOption,
  CategorizationSuggestion,
} from '../../domain/services/IAIProvider'

/**
 * Normalize a Brazilian bank description to improve matching:
 * - Remove excessive whitespace and control chars
 * - Lowercase
 * - Strip common prefixes that add no semantic value
 * - Expand common abbreviations
 */
export function normalizeDescription(raw: string): string {
  let s = raw.trim().toLowerCase()

  // Remove extraneous codes at the end (e.g. trailing numbers/dates after spaces)
  s = s.replace(/\s+\d{5,}\s*$/, '')

  // Strip common noise prefixes
  s = s
    .replace(/^compra (debito|credito|cartao)\s*/i, '')
    .replace(/^pgto\s+/i, 'pagamento ')
    .replace(/^pag\s+/i, 'pagamento ')
    .replace(/^transf\s+/i, 'transferencia ')
    .replace(/^dep\s+/i, 'deposito ')
    .replace(/^saque\s+/i, 'saque ')
    .replace(/^ted\s+(credito|debito)?\s*/i, 'ted ')
    .replace(/^doc\s+(credito|debito)?\s*/i, 'doc ')

  // Normalize asterisks used by payment aggregators (e.g. "IFOOD*HAMBURGUERIA" → "ifood hamburgueria")
  s = s.replace(/\*/g, ' ')

  // Collapse multiple spaces
  s = s.replace(/\s{2,}/g, ' ').trim()

  return s
}

// ── Category hint matrix ───────────────────────────────────────────────────
// For each default category, a list of keyword patterns that strongly suggest it.
// Used to enrich the prompt so the model has explicit signal mapping.
const CATEGORY_HINTS: Record<string, string[]> = {
  // Expense
  'Alimentação': [
    'padaria', 'lanchonete', 'cafe', 'cafeteria', 'pastelaria', 'pao de acucar', 'hortifruti',
    'açougue', 'acougue', 'peixaria', 'mercearia', 'frutaria', 'feira', 'quitanda',
  ],
  'Supermercado': [
    'supermercado', 'mercado', 'atacadao', 'carrefour', 'extra', 'pao de acucar',
    'assai', 'makro', 'fort atacadista', 'walmart', 'hiper', 'hipermercado',
    'sonda', 'zaffari', 'prezunic', 'dia supermercado', 'nagumo',
  ],
  'Restaurante e Delivery': [
    'ifood', 'rappi', 'uber eats', 'mc donalds', 'mcdonalds', 'subway', 'burger king',
    'kfc', 'pizzaria', 'sushi', 'churrascaria', 'restaurante', 'lanchonete', 'hamburgueria',
    'hamburguer', 'pizza', 'delivery', 'bob s', 'bobs', 'china in box', 'giraffas',
    'habib s', 'habibs', 'outback', 'coco bambu', 'applebees', 'dominos', 'patroni',
    'vivenda do camarao',
  ],
  'Moradia': [
    'aluguel', 'condominio', 'condomínio', 'iptu', 'seguro residencial',
    'administradora', 'imobiliaria', 'imóveis', 'imoveis', 'loft', 'quinto andar',
    'vivareal', 'dpe', 'caixa habitacao',
  ],
  'Transporte': [
    'uber', '99pop', '99', 'cabify', 'onibus', 'ônibus', 'metro', 'metrô', 'metro sp',
    'metro rj', 'bilhete unico', 'bilhetagem', 'brt', 'trem', 'cptm', 'supervia',
    'intermunicipal', 'rodoviaria', 'passagem', 'passagem aerea', 'latam', 'gol',
    'azul', 'avianca', 'tam', 'taxi', 'táxi', '99taxi',
  ],
  'Combustível': [
    'posto', 'combustivel', 'gasolina', 'etanol', 'diesel', 'shell', 'petrobras',
    'br distribuidora', 'ale combustiveis', 'ipiranga', 'texaco', 'raizen', 'abastece ai',
    'posto de combustivel',
  ],
  'Saúde': [
    'hospital', 'clinica', 'clínica', 'medico', 'médico', 'consultorio', 'dentista',
    'odonto', 'plano de saude', 'plano saude', 'unimed', 'amil', 'bradesco saude',
    'sulamérica saude', 'hapvida', 'notre dame', 'ultrafarma', 'laboratorio',
    'exame', 'cirurgia', 'pronto socorro', 'upa', 'sus', 'fisioterapia', 'psicólogo',
    'psicologo', 'terapeuta', 'homeopatia',
  ],
  'Farmácia': [
    'farmacia', 'farmácia', 'drogaria', 'drogasil', 'drogaraia', 'droga raia',
    'pacheco', 'nissei', 'ultrafarma', 'panvel', 'pague menos', 'drogas don',
    'dpsp', 'araujo', 'drogafarma', 'coop farmacia',
  ],
  'Educação': [
    'escola', 'faculdade', 'universidade', 'colegio', 'colégio', 'curso',
    'mensalidade escolar', 'mensalidade', 'idiomas', 'ingles', 'inglês', 'espanhol',
    'wizard', 'ccaa', 'yázigi', 'fisk', 'cultura inglesa', 'udemy', 'coursera',
    'alura', 'rocketseat', 'descomplica', 'duolingo', 'material escolar',
    'livraria', 'livro', 'apostila', 'vestibular', 'enem',
  ],
  'Lazer e Entretenimento': [
    'cinema', 'teatro', 'show', 'ingresso', 'ticketmaster', 'sympla', 'eventim',
    'parque', 'zoologico', 'museu', 'aquario', 'festa', 'balada', 'bar',
    'pub', 'jogo', 'steam', 'playstation', 'xbox', 'nintendo', 'psn', 'ps4', 'ps5',
    'xbox live', 'game', 'games', 'nuuvem', 'epic games',
  ],
  'Assinaturas e Streaming': [
    'netflix', 'spotify', 'amazon prime', 'prime video', 'disney', 'hbo max', 'max',
    'globoplay', 'deezer', 'apple tv', 'apple music', 'youtube premium', 'paramount',
    'star plus', 'mubi', 'crunchyroll', 'twitch', 'adobe', 'microsoft 365',
    'office 365', 'google one', 'dropbox', 'icloud', 'linkedin premium',
    'notion', 'canva', 'figma', 'chatgpt', 'openai',
  ],
  'Roupas e Acessórios': [
    'renner', 'c&a', 'riachuelo', 'marisa', 'forever 21', 'zara', 'h&m',
    'hering', 'levis', 'nike', 'adidas', 'puma', 'track field', 'centauro',
    'shein', 'shopee roupa', 'dafiti', 'netshoes roupa', 'roupas', 'vestuario',
    'sapataria', 'calcados', 'calçados', 'arezzo', 'melissa',
  ],
  'Telefone e Internet': [
    'vivo', 'claro', 'tim', 'oi', 'nextel', 'net combo', 'net', 'sky', 'directv',
    'telefonica', 'anatel', 'fatura celular', 'recarga celular', 'internet',
    'banda larga', 'fibra', 'plano celular', 'recarga',
  ],
  'Energia Elétrica': [
    'energia eletrica', 'eletropaulo', 'cpfl', 'cemig', 'enel', 'light',
    'coelba', 'coelce', 'celg', 'energ', 'celesc', 'ceee', 'equatorial', 'neoenergia',
  ],
  'Água e Saneamento': [
    'agua', 'água', 'sabesp', 'copasa', 'corsan', 'sanepar', 'caema', 'casan',
    'casal', 'embasa', 'cagece', 'saneamento', 'conta de agua',
  ],
  'Academia e Esportes': [
    'academia', 'smartfit', 'bluefit', 'bio ritmo', 'contours', 'crossfit',
    'bodytech', 'fitness', 'spinning', 'natacao', 'natação', 'futebol', 'tenis',
    'tênis', 'beach tennis', 'padel', 'pilates', 'yoga',
  ],
  'Pet': [
    'pet', 'petshop', 'pet shop', 'racao', 'ração', 'cobasi', 'petz',
    'veterinario', 'veterinário', 'clinica veterinaria', 'canil', 'banho e tosa',
    'dogs', 'cats', 'aquário pet',
  ],
  'Viagem': [
    'hotel', 'pousada', 'hostel', 'airbnb', 'booking', 'trivago', 'expedia',
    'hurb', 'decolar', 'cvc', 'passagem', 'aeroporto', 'taxi aeroporto',
    'aluguel carro', 'localiza', 'movida', 'unidas', 'turismo', 'viagem',
    'resort', 'motel',
  ],
  'Impostos e Taxas': [
    'iptu', 'ipva', 'iof', 'imposto', 'taxa', 'dpvat', 'detran', 'multa',
    'cartorio', 'receita federal', 'prefeitura', 'tributo', 'licenciamento',
    'cnd', 'guia de recolhimento', 'darf', 'das mei',
  ],
  // Income
  'Salário': [
    'salario', 'salário', 'folha de pagamento', 'pagamento salario', 'adiantamento salarial',
    '13o salario', 'ferias', 'férias', 'rescisao', 'rescisão', 'proventos',
    'remuneracao', 'remuneração', 'rh pagamento',
  ],
  'Freelance': [
    'freelance', 'autonomo', 'autônomo', 'honorarios', 'honorários', 'prestacao de servico',
    'rps', 'nf servico', 'pagamento servico', 'projeto', 'consultoria',
  ],
  'Investimentos': [
    'rendimento', 'rentabilidade', 'juros', 'resgate', 'aplicacao', 'aplicação',
    'cdb', 'tesouro', 'lci', 'lca', 'fundo', 'acoes', 'ações', 'btg', 'xp investimentos',
    'rico', 'clear', 'nu invest', 'modal', 'inter invest', 'renda fixa', 'renda variavel',
    'cripto', 'bitcoin', 'binance',
  ],
  'Aluguel Recebido': [
    'aluguel recebido', 'receita aluguel', 'locacao recebida', 'renda aluguel',
    'locatario', 'contrato locacao',
  ],
  'Dividendos': [
    'dividendo', 'jscp', 'juros sobre capital', 'proventos acao', 'fii rendimento',
    'fundo imobiliario', 'dividends',
  ],
  'Reembolso': [
    'reembolso', 'estorno', 'devolucao', 'devolução', 'chargeback', 'cashback',
    'restituicao', 'restituição', 'pix estorno',
  ],
  'Presente': [
    'presente', 'gift', 'doacao', 'doação', 'recebido de', 'aniversario',
    'pix presente', 'transferencia presente',
  ],
}

export function buildSystemPrompt(): string {
  return `You are a financial transaction categorizer for a Brazilian personal finance app (Plutos).
Your goal is to match EACH transaction to the MOST SPECIFIC fitting category — "Outros" is a last resort.

━━━ CRITICAL RULES ━━━
1. ONLY assign a category whose "type" matches the transaction "type" ("income" → income category, "expense" → expense category).
2. "Outros (Despesa)" and "Outros (Receita)" must be used ONLY when you have exhausted ALL other options. They represent a failure to categorize — avoid them aggressively.
3. Use EVERY available signal: description keywords, merchant names, amount, and day-of-month.
4. Respond ONLY with a JSON object in exactly this format — no markdown, no extra text:
   {"results": [{"index": <number>, "categoryId": "<uuid>"}]}
5. Every transaction index must appear exactly once in "results".

━━━ DESCRIPTION PATTERNS (Brazilian banks) ━━━
Brazilian bank descriptions are noisy. Look for these patterns:
• "PIX ENVIADO / PIX RECEBIDO + name" → use context of name/amount to decide category
• "COMPRA DEBITO / COMPRA CREDITO + merchant" → look at merchant name
• "IFOOD*", "RAPPI*", "UBER*" → asterisk separates aggregator from merchant
• All-caps merchant names are normal; match case-insensitively
• Trailing codes/numbers after spaces are transaction IDs — ignore them
• "TED CREDITO / DOC CREDITO" for income → check description for salary/freelance clues
• "SALARIO", "PAGTO SALARIO", "FOLHA" → always Salário (income)
• "RENDIMENTO", "RESGATE CDB", "TESOURO" → Investimentos (income)

━━━ DAY-OF-MONTH HEURISTICS ━━━
• Day 1–10: likely rent, condominium, utilities, loan installments
• Day 5, 10, 15, 20, 25, 30: likely salary or regular bill payments
• Any day: delivery apps, streaming, supermarkets can occur anytime

━━━ COMMON BRAZILIAN MERCHANTS BY CATEGORY ━━━
Alimentação: padaria, cafeteria, hortifruti, açougue, feira, mercearia
Supermercado: carrefour, extra, assaí, atacadão, makro, zaffari, pão de açúcar, fort, walmart
Restaurante e Delivery: ifood, rappi, uber eats, mcdonalds, burger king, subway, dominos, pizzaria, restaurante, churrascaria
Moradia: aluguel, condomínio, iptu, imobiliária, administradora
Transporte: uber, 99pop, cabify, metro, ônibus, bilhete único, cptm, supervia, taxi
Combustível: posto, ipiranga, shell, petrobras, br distribuidora, gasolina, etanol
Saúde: hospital, clínica, médico, consultório, plano de saúde, unimed, amil, cirurgia, exame
Farmácia: drogasil, droga raia, pacheco, nissei, ultrafarma, panvel, pague menos, farmácia
Educação: escola, faculdade, curso, mensalidade, idiomas, wizard, ccaa, alura, udemy, livraria
Lazer e Entretenimento: cinema, teatro, show, ingresso, bar, balada, steam, playstation, game
Assinaturas e Streaming: netflix, spotify, amazon prime, disney, hbo max, globoplay, deezer, adobe, microsoft 365
Roupas e Acessórios: renner, riachuelo, c&a, zara, nike, adidas, dafiti, shein, sapataria
Telefone e Internet: vivo, claro, tim, oi, net, sky, recarga, fatura celular, internet, fibra
Energia Elétrica: enel, cemig, cpfl, light, coelba, eletropaulo, neoenergia, equatorial
Água e Saneamento: sabesp, copasa, corsan, sanepar, embasa, água
Academia e Esportes: academia, smartfit, bluefit, bodytech, crossfit, pilates, yoga, natação
Pet: petshop, cobasi, petz, veterinário, ração, banho e tosa
Viagem: hotel, airbnb, booking, localiza, movida, cvc, decolar, aeroporto
Impostos e Taxas: ipva, iptu, iof, detran, dpvat, multa, receita federal, guia, darf, das mei
Salário: salário, folha, pagamento, adiantamento, 13o, férias, rescisão
Freelance: freelance, autônomo, honorários, prestação de serviço, consultoria
Investimentos: rendimento, resgate, cdb, tesouro, lci, fundo, ações, btg, xp, nu invest
Aluguel Recebido: aluguel recebido, receita aluguel, locação recebida
Dividendos: dividendo, jscp, juros sobre capital, fii rendimento
Reembolso: estorno, reembolso, devolução, chargeback, cashback, restituição
Presente: presente, doação, gift`
}

export function buildUserPrompt(
  transactions: TransactionToCategorize[],
  categories: CategoryOption[],
): string {
  // Attach keyword hints inline to each category so the model has them at decision time
  const categoryList = categories
    .map((c) => {
      const hints = CATEGORY_HINTS[c.name]
      const hintStr = hints && hints.length > 0
        ? ` [keywords: ${hints.slice(0, 8).join(', ')}]`
        : ''
      return `  {"id": "${c.id}", "name": "${c.name}", "type": "${c.type}"${hintStr}}`
    })
    .join('\n')

  const txList = transactions
    .map((t) => {
      const normalized = normalizeDescription(t.description)
      const dayOfMonth = t.date ? new Date(t.date).getDate() : null
      const dayLabel = dayOfMonth ? `, "day": ${dayOfMonth}` : ''
      // Include both original and normalized so the model can see the raw signal too
      const descField = normalized !== t.description.toLowerCase().trim()
        ? `"description": "${escapeJson(normalized)}", "raw": "${escapeJson(t.description)}"`
        : `"description": "${escapeJson(normalized)}"`
      return `  {"index": ${t.index}, ${descField}, "amount": ${t.amount}, "type": "${t.type}"${dayLabel}}`
    })
    .join('\n')

  return `Available categories (use "id" in your response):
[
${categoryList}
]

Transactions to categorize (match each to the best category — avoid "Outros" unless truly necessary):
[
${txList}
]

Respond with JSON object — every index must appear once:
{"results": [{"index": 0, "categoryId": "<uuid>"}, ...]}`
}

function escapeJson(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export function parseCategorizationResponse(
  raw: string,
  categories: CategoryOption[],
): CategorizationSuggestion[] {
  try {
    const categoryIds = new Set(categories.map((c) => c.id))

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
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

    let items: unknown[]
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      Array.isArray((parsed as Record<string, unknown>).results)
    ) {
      items = (parsed as Record<string, unknown>).results as unknown[]
    } else if (Array.isArray(parsed)) {
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
