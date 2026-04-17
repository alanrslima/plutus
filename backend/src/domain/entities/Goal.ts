export type GoalType = 'spending_limit' | 'savings_target'
export type GoalStatus = 'active' | 'achieved' | 'cancelled'

export type Goal = {
  id: string
  userId: string
  categoryId?: string
  title: string
  targetAmount: number
  currentAmount: number
  deadline?: Date
  type: GoalType
  status: GoalStatus
  source: string
  createdAt: Date
}
