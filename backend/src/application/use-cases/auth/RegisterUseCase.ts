import { IUserRepository } from '../../../domain/repositories/IUserRepository'
import { ICategoryRepository } from '../../../domain/repositories/ICategoryRepository'
import { DEFAULT_CATEGORIES } from '../../data/defaultCategories'
import bcrypt from 'bcryptjs'

interface RegisterInput {
  name: string
  email: string
  password: string
}

interface RegisterOutput {
  id: string
  name: string
  email: string
}

export class RegisterUseCase {
  constructor(
    private userRepository: IUserRepository,
    private categoryRepository: ICategoryRepository,
  ) {}

  async execute({ name, email, password }: RegisterInput): Promise<RegisterOutput> {
    const existing = await this.userRepository.findByEmail(email)
    if (existing) {
      throw new Error('Email already in use')
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await this.userRepository.create({ name, email, passwordHash })

    await this.categoryRepository.createMany(
      DEFAULT_CATEGORIES.map((c) => ({ userId: user.id, name: c.name, type: c.type })),
    )

    return { id: user.id, name: user.name, email: user.email }
  }
}
