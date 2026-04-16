export type FileType = 'OFX' | 'CSV'
export type ImportStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED'

export interface ImportHistory {
  id: string
  userId: string
  accountId: string
  filename: string
  fileType: FileType
  status: ImportStatus
  importedCount: number
  skippedCount: number
  errorMessage?: string | null
  createdAt: Date
}
