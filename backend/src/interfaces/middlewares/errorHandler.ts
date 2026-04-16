import { Request, Response, NextFunction } from 'express'
import { AppError } from '../../application/errors/AppError'

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({ message: err.message })
    return
  }
  const known = ['Email already in use', 'Invalid credentials', 'Account not found', 'Category not found', 'Transaction not found', 'Destination account required for transfers', 'Destination account not found']
  const status = known.includes(err.message) ? 400 : 500
  const message = status === 500 ? 'Internal server error' : err.message
  if (status === 500) console.error(err)
  res.status(status).json({ message })
}
