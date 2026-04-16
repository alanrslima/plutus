import { IImportRepository } from '../../../domain/repositories/IImportRepository'
import { IAccountRepository } from '../../../domain/repositories/IAccountRepository'
import { ITransactionRepository } from '../../../domain/repositories/ITransactionRepository'
import { ICategoryRepository } from '../../../domain/repositories/ICategoryRepository'
import { ImportHistory, FileType } from '../../../domain/entities/ImportHistory'
import { ParsedTransaction } from '../../../domain/entities/ParsedTransaction'
import { OFXParser } from '../../../infra/parsers/OFXParser'
import { CSVParser } from '../../../infra/parsers/CSVParser'
import { AppError } from '../../errors/AppError'
import { prisma } from '../../../infra/database/prisma'

export interface ImportResult {
  importedCount: number
  skippedCount: number
  importHistory: ImportHistory
}

function isUniqueViolation(err: unknown): boolean {
  return (
    (typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: unknown }).code === 'P2002') ||
    (err instanceof Error && err.message.includes('external_id'))
  )
}

export class ImportUseCase {
  constructor(
    private importRepo: IImportRepository,
    private accountRepo: IAccountRepository,
    private transactionRepo: ITransactionRepository,
    private categoryRepo: ICategoryRepository,
    private ofxParser: OFXParser,
    private csvParser: CSVParser,
  ) {}

  parseFile(fileContent: string, fileType: FileType): ParsedTransaction[] {
    if (fileType === 'OFX') {
      return this.ofxParser.parse(fileContent)
    }
    return this.csvParser.parse(fileContent)
  }

  async importTransactions(
    userId: string,
    accountId: string,
    fileContent: string,
    filename: string,
    fileType: FileType,
    parsedTransactions: ParsedTransaction[],
  ): Promise<ImportResult> {
    const account = await this.accountRepo.findById(accountId, userId)
    if (!account) {
      throw new AppError('Account not found', 404)
    }

    const categories = await this.categoryRepo.findAllByUser(userId)

    let importedCount = 0
    let skippedCount = 0

    for (const pt of parsedTransactions) {
      const matchedCategory = categories.find(
        (c) => c.name.toLowerCase() === (pt.category ?? '').toLowerCase() && pt.category,
      )

      try {
        await prisma.transaction.create({
          data: {
            userId,
            accountId,
            type: pt.type,
            amount: pt.amount,
            description: pt.description,
            date: pt.date,
            categoryId: matchedCategory?.id ?? null,
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
