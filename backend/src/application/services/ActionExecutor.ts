import { ActionType, CopilotInsight } from '../../domain/entities/CopilotInsight'
import { GoalUseCase } from '../use-cases/goals/GoalUseCase'
import { ICopilotInsightRepository } from '../../domain/repositories/ICopilotInsightRepository'
import { createLogger } from '../../infra/logger'

const log = createLogger('ActionExecutor')

export class ActionExecutor {
  constructor(
    private goalUseCase: GoalUseCase,
    private insightRepo: ICopilotInsightRepository,
  ) {}

  async execute(
    insight: CopilotInsight,
    userId: string,
    overridePayload?: Record<string, unknown>,
  ): Promise<void> {
    const payload = overridePayload ?? insight.actionPayload ?? {}
    const actionType = insight.actionType as ActionType

    log.info({ insightId: insight.id, actionType }, 'Executing copilot action')

    switch (actionType) {
      case 'create_goal':
      case 'create_budget': {
        const title = (payload.title as string) ?? insight.title
        const targetAmount = Number(payload.targetAmount ?? 0)
        const type = (payload.type as 'spending_limit' | 'savings_target') ?? 'spending_limit'
        const categoryId = (payload.categoryId as string) ?? undefined
        const deadlineStr = payload.deadline as string | undefined
        const deadline = deadlineStr ? new Date(deadlineStr) : undefined

        await this.goalUseCase.create(userId, {
          title,
          targetAmount,
          type,
          categoryId,
          deadline,
          source: 'copilot',
        })
        break
      }

      case 'tag_subscription':
        // Informational — just mark the insight as acted on
        log.info({ description: payload.description }, 'Subscription tagged')
        break

      default:
        log.warn({ actionType }, 'Unknown action type')
    }

    await this.insightRepo.markActionTaken(insight.id, userId)
  }
}
