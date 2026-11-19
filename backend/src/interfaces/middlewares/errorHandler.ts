import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../../application/errors/AppError'
import { createLogger } from '../../infra/logger'

const log = createLogger('errorHandler')

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({ message: err.message })
    return
  }
  if (err instanceof ZodError) {
    // `message` keeps the shape the frontend reads (err.response.data.message); `issues` lists every field error
    const issues = err.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message }))
    const first = issues[0]
    res.status(400).json({
      message: first ? (first.path ? `${first.path}: ${first.message}` : first.message) : 'Dados inválidos',
      issues,
    })
    return
  }
  log.error({ err, method: req.method, url: req.url }, 'Unhandled error')
  res.status(500).json({ message: 'Internal server error' })
}
