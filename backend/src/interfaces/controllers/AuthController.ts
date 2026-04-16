import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { RegisterUseCase } from '../../application/use-cases/auth/RegisterUseCase'
import { LoginUseCase } from '../../application/use-cases/auth/LoginUseCase'
import { PrismaUserRepository } from '../../infra/database/repositories/PrismaUserRepository'
import { PrismaCategoryRepository } from '../../infra/database/repositories/PrismaCategoryRepository'

const userRepo = new PrismaUserRepository()
const categoryRepo = new PrismaCategoryRepository()
const registerUseCase = new RegisterUseCase(userRepo, categoryRepo)
const loginUseCase = new LoginUseCase(userRepo)

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const data = registerSchema.parse(req.body)
      const result = await registerUseCase.execute(data)
      res.status(201).json(result)
    } catch (err) {
      next(err)
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const data = loginSchema.parse(req.body)
      const result = await loginUseCase.execute(data)
      res.json(result)
    } catch (err) {
      next(err)
    }
  }
}
