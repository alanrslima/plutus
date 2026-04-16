import { IImportRepository } from '../../../domain/repositories/IImportRepository'
import { IAccountRepository } from '../../../domain/repositories/IAccountRepository'
import { ITransactionRepository } from '../../../domain/repositories/ITransactionRepository'
import { ICategoryRepository } from '../../../domain/repositories/ICategoryRepository'
import { ImportHistory, FileType } from '../../../domain/entities/ImportHistory'
import { ParsedTransaction } from '../../../domain/entities/ParsedTransaction'
import { OFXParser } from '../../../infra/parsers/OFXParser'
import { CSVParser } from '../../../infra/parsers/CSVParser'
import { CategorizationService } from '../../services/CategorizationService'
import { AppError } from '../../errors/AppError'
import { prisma } from '../../../infra/database/prisma'

export interface ImportResult {
  importedCount: number
  skippedCount: number
  importHistory: ImportHistory
}

export interface ParseAndCategorizeResult {
  transactions: ParsedTransaction[]
  aiEnabled: boolean
}

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  // Prisma unique constraint violation
  if ('code' in err && (err as { code: unknown }).code === 'P2002') return true
  if (err instanceof Error && err.message.includes('external_id')) return true
  return false
}

export class ImportUseCase {
  constructor(
    private importRepo: IImportRepository,
    private accountRepo: IAccountRepository,
    private transactionRepo: ITransactionRepository,
    private categoryRepo: ICategoryRepository,
    private ofxParser: OFXParser,
    private csvParser: CSVParser,
    private categorizationService?: CategorizationService,
  ) {}

  /** Parse file and optionally enrich with AI category suggestions. */
  async parseAndCategorize(
    fileContent: string,
    fileType: FileType,
    userId: string,
  ): Promise<ParseAndCategorizeResult> {
    const parsed = fileType === 'OFX'
      ? this.ofxParser.parse(fileContent)
      : this.csvParser.parse(fileContent)

    if (!this.categorizationService || !this.categorizationService.isEnabled) {
      return { transactions: parsed, aiEnabled: false }
    }

    const categories = await this.categoryRepo.findAllByUser(userId)
    const enriched = await this.categorizationService.suggestCategories(parsed, categories)
    return { transactions: enriched, aiEnabled: true }
  }

  /** Legacy synchronous parse (kept for backward compat). */
  parseFile(fileContent: string, fileType: FileType): ParsedTransaction[] {
    return fileType === 'OFX'
      ? this.ofxParser.parse(fileContent)
      : this.csvParser.parse(fileContent)
  }

  async importTransactions(
    userId: string,
    accountId: string,
    _fileContent: string,
    filename: string,
    fileType: FileType,
    parsedTransactions: (ParsedTransaction & { categoryId?: string | null })[],
  ): Promise<ImportResult> {
    const account = await this.accountRepo.findById(accountId, userId)
    if (!account) {
      throw new AppError('Account not found', 404)
    }

    // Only needed for OFX category-name matching fallback (when no categoryId provided)
    const categories = await this.categoryRepo.findAllByUser(userId)

    let importedCount = 0
    let skippedCount = 0

    for (const pt of parsedTransactions) {
      // Resolve categoryId: explicit choice from user > OFX name match > null
      let resolvedCategoryId: string | null = pt.categoryId ?? null

      if (!resolvedCategoryId && pt.category) {
        const matched = categories.find(
          (c) => c.name.toLowerCase() === pt.category!.toLowerCase(),
        )
        resolvedCategoryId = matched?.id ?? null
      }

      try {
        await prisma.transaction.create({
          data: {
            userId,
            accountId,
            type: pt.type,
            amount: pt.amount,
            description: pt.description,
            date: pt.date,
            categoryId: resolvedCategoryId,
            destinationAccountId: null,
            installment: null,
            totalInstallments: null,
            parentTransactionId: null,
            externalId: pt.externalId,
          },
        })

        const delta = pt.type === 'income' ? pt.amount : -pt.amount
        await this.accountRepo.updateBalance(accountId, delta)

        importedCount++
      } catch (err) {
        if (isUniqueViolation(err)) {
          skippedCount++
        } else {
          throw err
        }
      }
    }

    const totalProcessed = importedCount + skippedCount
    const status =
      importedCount === 0 && totalProcessed > 0
        ? 'FAILED'
        : skippedCount > 0
          ? 'PARTIAL'
          : 'SUCCESS'

    const importHistory = await this.importRepo.createImportHistory({
      userId,
      accountId,
      filename,
      fileType,
      status,
      importedCount,
      skippedCount,
    })

    return { importedCount, skippedCount, importHistory }
  }

  async getHistory(userId: string): Promise<(ImportHistory & { accountName: string })[]> {
    return this.importRepo.findHistoryByUser(userId) as Promise<
      (ImportHistory & { accountName: string })[]
    >
  }

  async getHistoryByAccount(userId: string, accountId: string): Promise<ImportHistory[]> {
    return this.importRepo.findHistoryByAccount(accountId, userId)
  }
}
