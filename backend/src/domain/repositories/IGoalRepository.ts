import { Goal, GoalStatus } from '../entities/Goal'

export interface IGoalRepository {
  findById(id: string, userId: string): Promise<Goal | null>
  findAllByUser(userId: string): Promise<Goal[]>
  create(data: Omit<Goal, 'id' | 'createdAt' | 'currentAmount'>): Promise<Goal>
  updateStatus(id: string, userId: string, status: GoalStatus): Promise<Goal>
  updateCurrentAmount(id: string, userId: string, amount: number): Promise<Goal>
  delete(id: string, userId: string): Promise<void>
}
