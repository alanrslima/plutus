import { IImportRepository, CreateImportHistoryInput } from '../../../domain/repositories/IImportRepository'
import { ImportHistory } from '../../../domain/entities/ImportHistory'
import { FileType, ImportStatus } from '../../../domain/entities/ImportHistory'
import { prisma } from '../prisma'

function toImportHistory(raw: {
  id: string
  userId: string
  accountId: string
  filename: string
  fileType: string
  status: string
  importedCount: number
  skippedCount: number
  errorMessage: string | null
  createdAt: Date
}): ImportHistory {
  return {
    id: raw.id,
    userId: raw.userId,
    accountId: raw.accountId,
    filename: raw.filename,
    fileType: raw.fileType as FileType,
    status: raw.status as ImportStatus,
    importedCount: raw.importedCount,
    skippedCount: raw.skippedCount,
    errorMessage: raw.errorMessage,
    createdAt: raw.createdAt,
  }
}

export class PrismaImportRepository implements IImportRepository {
  async createImportHistory(data: CreateImportHistoryInput): Promise<ImportHistory> {
    const record = await prisma.importHistory.create({ data })
    return toImportHistory(record)
  }

  async findHistoryByAccount(accountId: string, userId: string): Promise<ImportHistory[]> {
    const records = await prisma.importHistory.findMany({
      where: { accountId, userId },
      orderBy: { createdAt: 'desc' },
    })
    return records.map(toImportHistory)
  }

  async findHistoryByUser(userId: string): Promise<(ImportHistory & { accountName: string })[]> {
    const records = await prisma.importHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { account: { select: { name: true } } },
    })
    return records.map((r) => ({
      ...toImportHistory(r),
      accountName: r.account.name,
    }))
  }
}
