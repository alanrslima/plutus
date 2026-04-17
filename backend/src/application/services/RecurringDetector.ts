import { prisma } from '../../infra/database/prisma'

export interface RecurringExpense {
  description: string
  estimatedMonthlyAmount: number
  lastSeenDaysAgo: number
  occurrences: number
}

export class RecurringDetector {
  async detect(userId: string): Promise<RecurringExpense[]> {
    const since = new Date()
    since.setDate(since.getDate() - 90)

    const transactions = await prisma.transaction.findMany({
      where: { userId, type: 'expense', date: { gte: since } },
      select: { description: true, amount: true, date: true },
      orderBy: { date: 'desc' },
    })

    // Group by normalized description
    const groups = new Map<string, { amount: number; date: Date }[]>()
    for (const t of transactions) {
      const key = this.normalize(t.description ?? '')
      if (!key) continue
      const list = groups.get(key) ?? []
      list.push({ amount: t.amount.toNumber(), date: t.date })
      groups.set(key, list)
    }

    const recurring: RecurringExpense[] = []

    for (const [desc, entries] of groups) {
      if (entries.length < 2) continue

      // Check if amounts are within ±10% of each other
      const amounts = entries.map(e => e.amount)
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length
      const allClose = amounts.every(a => Math.abs(a - avgAmount) / avgAmount <= 0.1)
      if (!allClose) continue

      // Check if intervals suggest monthly recurrence (20–45 days)
      const sorted = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime())
      const intervals: number[] = []
      for (let i = 1; i < sorted.length; i++) {
        const days = (sorted[i].date.getTime() - sorted[i - 1].date.getTime()) / (1000 * 60 * 60 * 24)
        intervals.push(days)
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
      if (avgInterval < 20 || avgInterval > 45) continue

      const lastDate = entries[0].date
      const lastSeenDaysAgo = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

      recurring.push({
        description: desc,
        estimatedMonthlyAmount: Math.round(avgAmount * 100) / 100,
        lastSeenDaysAgo,
        occurrences: entries.length,
      })
    }

    // Sort by monthly amount desc, limit to top 10
    return recurring.sort((a, b) => b.estimatedMonthlyAmount - a.estimatedMonthlyAmount).slice(0, 10)
  }

  private normalize(description: string): string {
    return description
      .toLowerCase()
      .replace(/\d+/g, '')      // remove numbers (avoids "pagamento 001" vs "pagamento 002")
      .replace(/[^\w\s]/g, '')  // remove punctuation
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60)
  }
}
