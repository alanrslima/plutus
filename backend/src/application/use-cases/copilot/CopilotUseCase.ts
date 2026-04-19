import { ICopilotInsightRepository } from '../../../domain/repositories/ICopilotInsightRepository'
import { IGoalRepository } from '../../../domain/repositories/IGoalRepository'
import { FinancialContextBuilder } from '../../services/FinancialContextBuilder'
import { RecurringDetector } from '../../services/RecurringDetector'
import { ActionExecutor } from '../../services/ActionExecutor'
import { GoalUseCase } from '../goals/GoalUseCase'
import { AIProviderFactory } from '../../../infra/ai/AIProviderFactory'
import { buildCopilotSystemPrompt, buildCopilotUserPrompt } from '../../../infra/ai/buildCopilotPrompt'
import { parseCopilotResponse } from '../../../infra/ai/parseCopilotResponse'
import { CopilotInsight } from '../../../domain/entities/CopilotInsight'
import { AppError } from '../../errors/AppError'
import { createLogger } from '../../../infra/logger'

const log = createLogger('CopilotUseCase')

const THROTTLE_HOURS = 1
const INSIGHT_TTL_DAYS = 7
const MIN_DATA_MONTHS = 1
const MIN_TRANSACTIONS = 10

export class CopilotUseCase {
  private contextBuilder: FinancialContextBuilder
  private actionExecutor: ActionExecutor

  constructor(
    private insightRepo: ICopilotInsightRepository,
    private goalRepo: IGoalRepository,
  ) {
    const recurringDetector = new RecurringDetector()
    this.contextBuilder = new FinancialContextBuilder(goalRepo, recurringDetector)
    const goalUseCase = new GoalUseCase(goalRepo)
    this.actionExecutor = new ActionExecutor(goalUseCase, insightRepo)
  }

  async getInsights(userId: string): Promise<CopilotInsight[]> {
    await this.insightRepo.expireOldByUser(userId)
    return this.insightRepo.findActiveByUser(userId)
  }

  /** Streams analysis via SSE. Caller is responsible for setting headers. */
  async analyze(
    userId: string,
    onToken: (token: string) => void,
    onDone: (insights: CopilotInsight[]) => void,
    onError: (err: Error) => void,
  ): Promise<void> {
    try {
      // Throttle check
      const recent = await this.insightRepo.findRecentByUser(userId, THROTTLE_HOURS)
      if (recent.length > 0) {
        const mins = Math.ceil(
          (THROTTLE_HOURS * 60) -
          (Date.now() - recent[0].createdAt.getTime()) / 60000,
        )
        throw new AppError(`Análise disponível novamente em ${mins} minuto(s).`, 429)
      }

      // Build context
      const ctx = await this.contextBuilder.build(userId)
      log.info({ userId, dataMonths: ctx.dataMonths }, 'Financial context built')

      if (ctx.dataMonths < MIN_DATA_MONTHS || ctx.summary.currentMonth.expense + ctx.summary.currentMonth.income < MIN_TRANSACTIONS / 10) {
        throw new AppError('insufficient_data', 422)
      }

      const provider = AIProviderFactory.create()
      if (provider.name === 'none') throw new AppError('AI provider not configured', 503)
      if (!(await provider.isAvailable())) throw new AppError('AI provider unavailable', 503)

      const systemPrompt = buildCopilotSystemPrompt()
      const userPrompt = buildCopilotUserPrompt(ctx)

      log.debug({ provider: provider.name }, 'Starting copilot stream')

      const fullText = await provider.complete(systemPrompt, userPrompt, onToken)

      log.debug({ fullText }, 'Copilot stream complete')

      // Parse and persist
      const parsed = parseCopilotResponse(fullText)
      if (parsed.length === 0) {
        throw new AppError('O modelo não retornou insights válidos. Tente novamente.', 500)
      }

      const expiresAt = new Date(Date.now() + INSIGHT_TTL_DAYS * 24 * 60 * 60 * 1000)
      const saved = await this.insightRepo.createMany(
        parsed.map(p => ({
          userId,
          type: p.type,
          title: p.title,
          body: p.body,
          data: undefined,
          actionType: p.actionType,
          actionPayload: p.actionPayload,
          expiresAt,
        })),
      )

      onDone(saved)
    } catch (err) {
      onError(err instanceof Error ? err : new Error(String(err)))
    }
  }

  async executeAction(
    insightId: string,
    userId: string,
    overridePayload?: Record<string, unknown>,
  ): Promise<void> {
    const insights = await this.insightRepo.findActiveByUser(userId)
    const insight = insights.find(i => i.id === insightId)
    if (!insight) throw new AppError('Insight not found', 404)
    if (insight.actionTaken) throw new AppError('Action already taken', 409)
    if (!insight.actionType) throw new AppError('This insight has no action', 400)
    await this.actionExecutor.execute(insight, userId, overridePayload)
  }

  async dismiss(insightId: string, userId: string): Promise<void> {
    await this.insightRepo.dismiss(insightId, userId)
  }
}
