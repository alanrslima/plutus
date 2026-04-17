import { Response, NextFunction } from 'express'
import { z } from 'zod'
import { AuthRequest } from '../middlewares/authMiddleware'
import { CopilotUseCase } from '../../application/use-cases/copilot/CopilotUseCase'
import { PrismaCopilotInsightRepository } from '../../infra/database/repositories/PrismaCopilotInsightRepository'
import { PrismaGoalRepository } from '../../infra/database/repositories/PrismaGoalRepository'
import { AppError } from '../../application/errors/AppError'

const insightRepo = new PrismaCopilotInsightRepository()
const goalRepo = new PrismaGoalRepository()
const useCase = new CopilotUseCase(insightRepo, goalRepo)

const actionSchema = z.object({
  insightId: z.string().uuid(),
  payload: z.record(z.unknown()).optional(),
})

export class CopilotController {
  getInsights = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const insights = await useCase.getInsights(req.userId!)
      res.json({ insights })
    } catch (err) { next(err) }
  }

  analyze = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    // Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }

    await useCase.analyze(
      req.userId!,
      token => send('token', { token }),
      insights => {
        send('done', { insights })
        res.end()
      },
      err => {
        const isAppError = err instanceof AppError
        send('error', {
          message: err.message,
          code: isAppError ? (err as AppError).status : 500,
        })
        res.end()
      },
    )
  }

  executeAction = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { insightId, payload } = actionSchema.parse(req.body)
      await useCase.executeAction(insightId, req.userId!, payload)
      res.json({ success: true })
    } catch (err) { next(err) }
  }

  dismiss = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await useCase.dismiss(req.params.id, req.userId!)
      res.status(204).send()
    } catch (err) { next(err) }
  }
}
