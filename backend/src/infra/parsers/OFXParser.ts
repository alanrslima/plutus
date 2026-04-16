import { XMLParser } from 'fast-xml-parser'
import { ParsedTransaction } from '../../domain/entities/ParsedTransaction'

const INCOME_TYPES = new Set(['CREDIT', 'INT', 'DIV', 'DEP', 'DIRECTDEP'])

function parseOFXDate(raw: string): Date {
  // OFX dates: 20240115120000[-3:BRT] or 20240115 — use YYYYMMDD prefix only
  const digits = String(raw).replace(/\D.*/, '')
  const year = parseInt(digits.slice(0, 4), 10)
  const month = parseInt(digits.slice(4, 6), 10) - 1
  const day = parseInt(digits.slice(6, 8), 10)
  return new Date(year, month, day)
}

function parseAmount(raw: string | number): number {
  return parseFloat(String(raw).replace(',', '.'))
}

function resolveDescription(trn: Record<string, unknown>): string {
  const memo = trn['MEMO']
  if (memo != null && String(memo).trim() !== '') return String(memo).trim()
  const name = trn['NAME']
  if (name != null && String(name).trim() !== '') return String(name).trim()
  return String(trn['TRNTYPE'] ?? '').trim()
}

function stripOFX1Header(content: string): string {
  // OFX 1.x has SGML-like header lines before the <OFX> tag
  const ofxTagIndex = content.indexOf('<OFX>')
  if (ofxTagIndex === -1) return content
  return content.slice(ofxTagIndex)
}

function extractTransactions(raw: string): Record<string, unknown>[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: true,
    trimValues: true,
  })

  const parsed = parser.parse(raw)
  const ofx = parsed['OFX'] ?? parsed

  // Bank account path
  const bankStmt =
    ofx?.['BANKMSGSRSV1']?.['STMTTRNRS']?.['STMTRS'] ??
    ofx?.['BANKMSGSRSV1']?.['STMTTRNRS']

  // Credit card path
  const ccStmt =
    ofx?.['CREDITCARDMSGSRSV1']?.['CCSTMTTRNRS']?.['CCSTMTRS'] ??
    ofx?.['CREDITCARDMSGSRSV1']?.['CCSTMTTRNRS']

  const stmtrs = bankStmt ?? ccStmt
  if (!stmtrs) return []

  const tranList = stmtrs['BANKTRANLIST']
  if (!tranList) return []

  const stmtTrn = tranList['STMTTRN']
  if (!stmtTrn) return []

  return Array.isArray(stmtTrn) ? stmtTrn : [stmtTrn]
}

export class OFXParser {
  parse(content: string): ParsedTransaction[] {
    try {
      let xml: string

      const trimmed = content.trimStart()
      if (trimmed.startsWith('<?xml') || trimmed.startsWith('<?OFX')) {
        // OFX 2.x — valid XML
        xml = content
      } else {
        // OFX 1.x — strip SGML header lines before <OFX>
        xml = stripOFX1Header(content)
      }

      const rawTransactions = extractTransactions(xml)

      return rawTransactions.map((trn) => {
        const rawAmt = parseAmount(trn['TRNAMT'] as string | number)
        const trnType = String(trn['TRNTYPE'] ?? '').toUpperCase()

        const type: 'income' | 'expense' =
          rawAmt > 0 || INCOME_TYPES.has(trnType) ? 'income' : 'expense'

        return {
          externalId: String(trn['FITID']).trim(),
          date: parseOFXDate(trn['DTPOSTED'] as string),
          amount: Math.abs(rawAmt),
          type,
          description: resolveDescription(trn as Record<string, unknown>),
        }
      })
    } catch {
      throw new Error('Arquivo OFX inválido ou corrompido')
    }
  }
}
