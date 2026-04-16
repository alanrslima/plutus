import { ImportHistory, FileType, ImportStatus } from '../entities/ImportHistory'

export interface CreateImportHistoryInput {
  userId: string
  accountId: string
  filename: string
  fileType: FileType
  status: ImportStatus
  importedCount: number
  skippedCount: number
  errorMessage?: string
}

export interface IImportRepository {
  createImportHistory(data: CreateImportHistoryInput): Promise<ImportHistory>
  findHistoryByAccount(accountId: string, userId: string): Promise<ImportHistory[]>
  findHistoryByUser(userId: string): Promise<ImportHistory[]>
}
