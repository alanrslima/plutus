import { createHash } from 'crypto'
import { ParsedTransaction } from '../../domain/entities/ParsedTransaction'

type CSVFormat = 'nubank' | 'inter' | 'generic'

function generateExternalId(date: Date, amount: number, description: string): string {
  return createHash('sha256')
    .update(`${date.toISOString()}|${amount}|${description}`)
    .digest('hex')
    .slice(0, 32)
}

/**
 * Parse Brazilian and US number formats:
 *   1.234,56  →  1234.56
 *   1,234.56  →  1234.56
 *   -150,00   →  -150.00
 */
function parseBrazilianNumber(raw: string): number {
  const trimmed = raw.trim().replace(/\s/g, '')
  // If both separators are present, determine which is decimal by position
  const hasDot = trimmed.includes('.')
  const hasComma = trimmed.includes(',')

  let normalized: string
  if (hasDot && hasComma) {
    const dotIndex = trimmed.lastIndexOf('.')
    const commaIndex = trimmed.lastIndexOf(',')
    if (commaIndex > dotIndex) {
      // European: 1.234,56
      normalized = trimmed.replace(/\./g, '').replace(',', '.')
    } else {
      // US: 1,234.56
      normalized = trimmed.replace(/,/g, '')
    }
  } else if (hasComma) {
    // Could be -150,00 (decimal comma) or 1,234 (thousands comma)
    // If there are exactly 3 digits after the comma, treat as decimal — both are ambiguous
    // but in Brazilian bank files commas are almost always the decimal separator
    normalized = trimmed.replace(',', '.')
  } else {
    normalized = trimmed
  }

  return parseFloat(normalized)
}

/**
 * Parse date formats: dd/mm/yyyy, yyyy-mm-dd, dd-mm-yyyy
 */
function parseDate(raw: string): Date {
  const s = raw.trim()

  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [year, month, day] = s.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  // dd/mm/yyyy or dd-mm-yyyy
  const separatorMatch = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/)
  if (separatorMatch) {
    const [, day, month, year] = separatorMatch.map(Number)
    return new Date(year, month - 1, day)
  }

  throw new Error(`Unrecognized date format: ${raw}`)
}

function splitCSVLine(line: string, separator: string): string[] {
  return line.split(separator).map((c) => c.replace(/^["']|["']$/g, '').trim())
}

function detectFormat(header: string): CSVFormat {
  const lower = header.toLowerCase()
  // Nubank fatura: "date,title,amount" or "Data,Descrição,Valor"
  if (
    (lower.includes('date') && lower.includes('title') && lower.includes('amount')) ||
    ((lower.includes('descrição') || lower.includes('descricao')) && lower.includes(','))
  ) {
    return 'nubank'
  }
  if (lower.includes('histórico') || lower.includes('historico') || lower.includes('lançamento') || lower.includes('lancamento')) {
    return 'inter'
  }
  return 'generic'
}

function findColumnIndex(headers: string[], ...keywords: string[]): number {
  return headers.findIndex((h) =>
    keywords.some((kw) => h.toLowerCase().includes(kw))
  )
}

function parseNubank(lines: string[]): ParsedTransaction[] {
  // Supports two Nubank CSV formats:
  //   Fatura (credit card): "date,title,amount"  — positive = expense, negative = income
  //   Conta (bank account): "Data,Descrição,Valor" — positive = income, negative = expense
  const headerLine = lines.find((l) => l.trim() !== '') ?? ''
  const isFatura = headerLine.toLowerCase().startsWith('date,title')

  const results: ParsedTransaction[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = splitCSVLine(line, ',')
    if (cols.length < 3) continue

    const date = parseDate(cols[0])
    const description = cols[1].trim()
    const rawAmount = parseBrazilianNumber(cols[2])
    const amount = Math.abs(rawAmount)

    // Credit card fatura: positive = expense (charge), negative = income (payment/credit)
    // Bank account:       positive = income (deposit),  negative = expense (debit)
    const type: 'income' | 'expense' = isFatura
      ? rawAmount >= 0 ? 'expense' : 'income'
      : rawAmount >= 0 ? 'income'  : 'expense'

    results.push({
      externalId: generateExternalId(date, amount, description),
      date,
      amount,
      type,
      description,
    })
  }
  return results
}

function parseInter(lines: string[]): ParsedTransaction[] {
  // Header: Data Lançamento;Histórico;Descrição;Valor;Saldo
  const results: ParsedTransaction[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = splitCSVLine(line, ';')
    if (cols.length < 4) continue

    const date = parseDate(cols[0])
    // Prefer col[2] (Descrição) over col[1] (Histórico) for description
    const description = (cols[2].trim() || cols[1].trim())
    const rawAmount = parseBrazilianNumber(cols[3])
    const amount = Math.abs(rawAmount)
    const type: 'income' | 'expense' = rawAmount >= 0 ? 'income' : 'expense'

    results.push({
      externalId: generateExternalId(date, amount, description),
      date,
      amount,
      type,
      description,
    })
  }
  return results
}

function parseGeneric(headerLine: string, lines: string[]): ParsedTransaction[] {
  // Auto-detect separator: semicolon or comma
  const separator = headerLine.includes(';') ? ';' : ','
  const headers = splitCSVLine(headerLine, separator).map((h) => h.toLowerCase())

  const dateIdx = findColumnIndex(headers, 'data', 'date')
  const descIdx = findColumnIndex(headers, 'descri', 'memo', 'hist', 'description', 'title', 'name')
  const amountIdx = findColumnIndex(headers, 'valor', 'amount', 'value', 'montant')

  if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
    throw new Error('Arquivo CSV inválido ou formato não reconhecido')
  }

  const results: ParsedTransaction[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = splitCSVLine(line, separator)
    if (cols.length <= Math.max(dateIdx, descIdx, amountIdx)) continue

    const date = parseDate(cols[dateIdx])
    const description = cols[descIdx].trim()
    const rawAmount = parseBrazilianNumber(cols[amountIdx])
    const amount = Math.abs(rawAmount)
    const type: 'income' | 'expense' = rawAmount >= 0 ? 'income' : 'expense'

    results.push({
      externalId: generateExternalId(date, amount, description),
      date,
      amount,
      type,
      description,
    })
  }
  return results
}

export class CSVParser {
  parse(content: string): ParsedTransaction[] {
    try {
      const lines = content.split(/\r?\n/)
      const headerLine = lines.find((l) => l.trim() !== '')
      if (!headerLine) throw new Error('Arquivo CSV inválido ou formato não reconhecido')

      const format = detectFormat(headerLine)

      switch (format) {
        case 'nubank':
          return parseNubank(lines)
        case 'inter':
          return parseInter(lines)
        default:
          return parseGeneric(headerLine, lines)
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'Arquivo CSV inválido ou formato não reconhecido') {
        throw err
      }
      throw new Error('Arquivo CSV inválido ou formato não reconhecido')
    }
  }
}
