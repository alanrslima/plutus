export type InsightType =
  | 'overspending'
  | 'recurring_detected'
  | 'savings_opportunity'
  | 'positive_trend'
  | 'anomaly'
  | 'budget_at_risk'

export type ActionType = 'create_goal' | 'create_budget' | 'tag_subscription'

export type CopilotInsight = {
  id: string
  userId: string
  type: InsightType
  title: string
  body: string
  data?: Record<string, unknown>
  actionType?: ActionType
  actionPayload?: Record<string, unknown>
  actionTaken: boolean
  dismissed: boolean
  createdAt: Date
  expiresAt?: Date
}
