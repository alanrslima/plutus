import { ICopilotInsightRepository } from '../../../domain/repositories/ICopilotInsightRepository'
import { CopilotInsight, InsightType, ActionType } from '../../../domain/entities/CopilotInsight'
import { prisma } from '../prisma'
import { Prisma } from '@prisma/client'

function toInsight(raw: {
  id: string; userId: string; type: string; title: string; body: string
  data: Prisma.JsonValue; actionType: string | null; actionPayload: Prisma.JsonValue
  actionTaken: boolean; dismissed: boolean; createdAt: Date; expiresAt: Date | null
}): CopilotInsight {
  return {
    id: raw.id,
    userId: raw.userId,
    type: raw.type as InsightType,
    title: raw.title,
    body: raw.body,
    data: raw.data ? (raw.data as Record<string, unknown>) : undefined,
    actionType: raw.actionType ? (raw.actionType as ActionType) : undefined,
    actionPayload: raw.actionPayload ? (raw.actionPayload as Record<string, unknown>) : undefined,
    actionTaken: raw.actionTaken,
    dismissed: raw.dismissed,
    createdAt: raw.createdAt,
    expiresAt: raw.expiresAt ?? undefined,
  }
}

export class PrismaCopilotInsightRepository implements ICopilotInsightRepository {
  async findActiveByUser(userId: string): Promise<CopilotInsight[]> {
    const rows = await prisma.copilotInsight.findMany({
      where: {
        userId,
        dismissed: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(toInsight)
  }

  async findRecentByUser(userId: string, sinceHours: number): Promise<CopilotInsight[]> {
    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000)
    const rows = await prisma.copilotInsight.findMany({
      where: { userId, createdAt: { gte: since } },
    })
    return rows.map(toInsight)
  }

  async createMany(
    insights: Omit<CopilotInsight, 'id' | 'createdAt' | 'actionTaken' | 'dismissed'>[],
  ): Promise<CopilotInsight[]> {
    const created = await prisma.$transaction(
      insights.map(i =>
        prisma.copilotInsight.create({
          data: {
            userId: i.userId,
            type: i.type,
            title: i.title,
            body: i.body,
            data: (i.data as Prisma.InputJsonValue) ?? Prisma.JsonNull,
            actionType: i.actionType ?? null,
            actionPayload: (i.actionPayload as Prisma.InputJsonValue) ?? Prisma.JsonNull,
            expiresAt: i.expiresAt ?? null,
          },
        }),
      ),
    )
    return created.map(toInsight)
  }

  async markActionTaken(id: string, userId: string): Promise<void> {
    await prisma.copilotInsight.updateMany({ where: { id, userId }, data: { actionTaken: true } })
  }

  async dismiss(id: string, userId: string): Promise<void> {
    await prisma.copilotInsight.updateMany({ where: { id, userId }, data: { dismissed: true } })
  }

  async expireOldByUser(userId: string): Promise<void> {
    await prisma.copilotInsight.updateMany({
      where: { userId, expiresAt: { lt: new Date() } },
      data: { dismissed: true },
    })
  }
}
