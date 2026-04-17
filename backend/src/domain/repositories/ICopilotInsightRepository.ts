import { CopilotInsight } from '../entities/CopilotInsight'

export interface ICopilotInsightRepository {
  findActiveByUser(userId: string): Promise<CopilotInsight[]>
  findRecentByUser(userId: string, sinceHours: number): Promise<CopilotInsight[]>
  createMany(insights: Omit<CopilotInsight, 'id' | 'createdAt' | 'actionTaken' | 'dismissed'>[]): Promise<CopilotInsight[]>
  markActionTaken(id: string, userId: string): Promise<void>
  dismiss(id: string, userId: string): Promise<void>
  expireOldByUser(userId: string): Promise<void>
}
