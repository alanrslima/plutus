import { InsightType, ActionType } from '../../domain/entities/CopilotInsight'
import { createLogger } from '../logger'

const log = createLogger('parseCopilotResponse')

const VALID_TYPES: InsightType[] = [
  'overspending', 'recurring_detected', 'savings_opportunity',
  'positive_trend', 'anomaly', 'budget_at_risk',
]
const VALID_ACTIONS: ActionType[] = ['create_goal', 'create_budget', 'tag_subscription']

export interface ParsedInsight {
  type: InsightType
  title: string
  body: string
  actionType?: ActionType
  actionPayload?: Record<string, unknown>
}

export function parseCopilotResponse(raw: string): ParsedInsight[] {
  // Strip markdown code fences if present
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    // Try to extract first JSON array from text
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (!match) {
      log.warn({ raw }, 'Could not parse copilot response as JSON')
      return []
    }
    try {
      parsed = JSON.parse(match[0])
    } catch {
      log.warn({ raw }, 'Could not parse extracted JSON array')
      return []
    }
  }

  if (!Array.isArray(parsed)) {
    log.warn('Copilot response is not an array')
    return []
  }

  const insights: ParsedInsight[] = []

  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue

    const type = (item as Record<string, unknown>).type as string
    const title = (item as Record<string, unknown>).title as string
    const body = (item as Record<string, unknown>).body as string
    const actionType = (item as Record<string, unknown>).actionType as string | null | undefined
    const actionPayload = (item as Record<string, unknown>).actionPayload as Record<string, unknown> | null | undefined

    if (!VALID_TYPES.includes(type as InsightType)) continue
    if (typeof title !== 'string' || title.trim().length === 0) continue
    if (typeof body !== 'string' || body.trim().length === 0) continue

    insights.push({
      type: type as InsightType,
      title: title.slice(0, 120),
      body,
      actionType: actionType && VALID_ACTIONS.includes(actionType as ActionType)
        ? (actionType as ActionType)
        : undefined,
      actionPayload: actionPayload ?? undefined,
    })
  }

  log.debug({ count: insights.length }, 'Parsed copilot insights')
  return insights.slice(0, 6)
}
