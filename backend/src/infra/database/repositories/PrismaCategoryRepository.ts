import { ICategoryRepository } from '../../../domain/repositories/ICategoryRepository'
import { Category, TransactionType } from '../../../domain/entities/Category'
import { prisma } from '../prisma'

function toCategory(raw: { id: string; userId: string; name: string; type: string; createdAt: Date }): Category {
  return {
    id: raw.id,
    userId: raw.userId,
    name: raw.name,
    type: raw.type as TransactionType,
    createdAt: raw.createdAt,
  }
}

export class PrismaCategoryRepository implements ICategoryRepository {
  async findById(id: string, userId: string): Promise<Category | null> {
    const category = await prisma.category.findFirst({ where: { id, userId } })
    return category ? toCategory(category) : null
  }

  async findAllByUser(userId: string, type?: TransactionType): Promise<Category[]> {
    const categories = await prisma.category.findMany({
      where: { userId, ...(type ? { type } : {}) },
      orderBy: { name: 'asc' },
    })
    return categories.map(toCategory)
  }

  async create(data: Omit<Category, 'id' | 'createdAt'>): Promise<Category> {
    const category = await prisma.category.create({ data })
    return toCategory(category)
  }

  async createMany(data: Omit<Category, 'id' | 'createdAt'>[]): Promise<void> {
    await prisma.category.createMany({ data })
  }

  async update(id: string, userId: string, data: Partial<Pick<Category, 'name' | 'type'>>): Promise<Category> {
    const category = await prisma.category.update({ where: { id }, data })
    return toCategory(category)
  }

  async delete(id: string, userId: string): Promise<void> {
    await prisma.category.delete({ where: { id } })
  }
}
