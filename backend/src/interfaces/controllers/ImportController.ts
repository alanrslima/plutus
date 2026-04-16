import { Response, NextFunction } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { AuthRequest } from '../middlewares/authMiddleware'
import { ImportUseCase } from '../../application/use-cases/import/ImportUseCase'
import { PrismaImportRepository } from '../../infra/database/repositories/PrismaImportRepository'
import { PrismaAccountRepository } from '../../infra/database/repositories/PrismaAccountRepository'
import { PrismaTransactionRepository } from '../../infra/database/repositories/PrismaTransactionRepository'
import { PrismaCategoryRepository } from '../../infra/database/repositories/PrismaCategoryRepository'
import { OFXParser } from '../../infra/parsers/OFXParser'
import { CSVParser } from '../../infra/parsers/CSVParser'
import { FileType } from '../../domain/entities/ImportHistory'
import { ParsedTransaction } from '../../domain/entities/ParsedTransaction'
import { AppError } from '../../application/errors/AppError'

const importRepo = new PrismaImportRepository()
const accountRepo = new PrismaAccountRepository()
const transactionRepo = new PrismaTransactionRepository()
const categoryRepo = new PrismaCategoryRepository()
const ofxParser = new OFXParser()
const csvParser = new CSVParser()
const useCase = new ImportUseCase(
  importRepo,
  accountRepo,
  transactionRepo,
  categoryRepo,
  ofxParser,
  csvParser,
)

const previewBodySchema = z.object({
  accountId: z.string().uuid(),
})

const parsedTransactionSchema = z.object({
  externalId: z.string(),
  date: z.string(),
  amount: z.number(),
  type: z.enum(['income', 'expense']),
  description: z.string(),
  category: z.string().optional(),
})

const confirmBodySchema = z.object({
  accountId: z.string().uuid(),
  filename: z.string(),
  fileType: z.enum(['OFX', 'CSV']),
  transactions: z.array(parsedTransactionSchema),
})

function detectFileType(mimetype: string, originalname: string): FileType {
  const lower = originalname.toLowerCase()
  if (lower.endsWith('.ofx')) return 'OFX'
  if (lower.endsWith('.csv')) return 'CSV'
  if (mimetype.includes('csv') || mimetype.includes('text/plain')) return 'CSV'
  return 'OFX'
}

export class ImportController {
  upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
  })

  parsePreview = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { accountId } = previewBodySchema.parse(req.body)

      if (!req.file) {
        throw new AppError('No file uploaded', 400)
      }

      const fileContent = req.file.buffer.toString('utf-8')
      const fileType = detectFileType(req.file.mimetype, req.file.originalname)

      const transactions = useCase.parseFile(fileContent, fileType)

      res.json({ transactions, total: transactions.length, fileType })
    } catch (err) {
      next(err)
    }
  }

  confirmImport = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { accountId, filename, fileType, transactions: rawTransactions } =
        confirmBodySchema.parse(req.body)

      const parsedTransactions: ParsedTransaction[] = rawTransactions.map((t) => ({
        externalId: t.externalId,
        date: new Date(t.date),
        amount: t.amount,
        type: t.type,
        description: t.description,
        category: t.category,
      }))

      const result = await useCase.importTransactions(
        req.userId!,
        accountId,
        '',
        filename,
        fileType as FileType,
        parsedTransactions,
      )

      res.status(201).json(result)
    } catch (err) {
      next(err)
    }
  }

  getHistory = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const history = await useCase.getHistory(req.userId!)
      res.json({ history })
    } catch (err) {
      next(err)
    }
  }
}
