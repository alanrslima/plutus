import { useState } from 'react'
import {
  TrendingUp, TrendingDown, AlertCircle, Lightbulb,
  RefreshCw, ShieldAlert, X, Zap, CheckCircle2,
} from 'lucide-react'
import { CopilotInsight, InsightType, ActionType } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ActionConfirmModal } from './ActionConfirmModal'
import { useExecuteAction, useDismissInsight } from '@/hooks/useCopilot'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'

const ICON_MAP: Record<InsightType, React.ReactNode> = {
  overspending: <TrendingDown className="h-5 w-5" />,
  recurring_detected: <RefreshCw className="h-5 w-5" />,
  savings_opportunity: <Lightbulb className="h-5 w-5" />,
  positive_trend: <TrendingUp className="h-5 w-5" />,
  anomaly: <AlertCircle className="h-5 w-5" />,
  budget_at_risk: <ShieldAlert className="h-5 w-5" />,
}

const COLOR_MAP: Record<InsightType, string> = {
  overspending: 'text-red-500 bg-red-500/10 border-red-500/20',
  recurring_detected: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  savings_opportunity: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  positive_trend: 'text-green-500 bg-green-500/10 border-green-500/20',
  anomaly: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
  budget_at_risk: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
}

const ACTION_BTN_LABEL: Record<ActionType, string> = {
  create_goal: 'Criar Meta',
  create_budget: 'Criar Limite',
  tag_subscription: 'Marcar Assinatura',
}

interface Props {
  insight: CopilotInsight
}

export function InsightCard({ insight }: Props) {
  const [done, setDone] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const executeAction = useExecuteAction()
  const dismissInsight = useDismissInsight()
  const { toast } = useToast()

  async function handleAction(payload: Record<string, unknown>) {
    try {
      await executeAction.mutateAsync({ insightId: insight.id, payload })
      setModalOpen(false)
      setDone(true)
      toast({ title: 'Feito!', description: 'A ação foi executada com sucesso.' })
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível executar a ação.' })
    }
  }

  async function handleDismiss() {
    try {
      await dismissInsight.mutateAsync(insight.id)
      setDone(true)
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível ignorar.' })
    }
  }

  if (done) return null

  const colorClass = COLOR_MAP[insight.type]

  return (
    <>
      <Card className={cn('border transition-all', colorClass.split(' ').find(c => c.startsWith('border-')))}>
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border', colorClass)}>
              {ICON_MAP[insight.type]}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm mb-1">{insight.title}</p>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {insight.body}
              </p>

              {!insight.actionTaken && (
                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  {insight.actionType && (
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setModalOpen(true)}
                      disabled={executeAction.isPending}
                    >
                      <Zap className="h-3.5 w-3.5" />
                      {ACTION_BTN_LABEL[insight.actionType]}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground"
                    onClick={handleDismiss}
                    disabled={dismissInsight.isPending}
                  >
                    <X className="h-3.5 w-3.5" />
                    Ignorar
                  </Button>
                </div>
              )}

              {insight.actionTaken && (
                <div className="flex items-center gap-1.5 mt-3 text-green-500 text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  Ação executada
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {insight.actionType && (
        <ActionConfirmModal
          insight={insight}
          open={modalOpen}
          onConfirm={handleAction}
          onCancel={() => setModalOpen(false)}
          isPending={executeAction.isPending}
        />
      )}
    </>
  )
}
