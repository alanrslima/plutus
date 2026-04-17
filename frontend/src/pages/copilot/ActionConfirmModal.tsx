import { useState } from 'react'
import { CopilotInsight, ActionType } from '@/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Props {
  insight: CopilotInsight
  open: boolean
  onConfirm: (payload: Record<string, unknown>) => void
  onCancel: () => void
  isPending: boolean
}

const ACTION_LABELS: Record<ActionType, string> = {
  create_goal: 'Criar Meta',
  create_budget: 'Criar Limite de Gasto',
  tag_subscription: 'Marcar como Assinatura',
}

export function ActionConfirmModal({ insight, open, onConfirm, onCancel, isPending }: Props) {
  const payload = insight.actionPayload ?? {}
  const actionType = insight.actionType!

  const [title, setTitle] = useState((payload.title as string) ?? insight.title)
  const [targetAmount, setTargetAmount] = useState(Number(payload.targetAmount ?? 0))
  const [type, setType] = useState((payload.type as string) ?? 'spending_limit')
  const [deadline, setDeadline] = useState((payload.deadline as string) ?? '')

  function handleConfirm() {
    if (actionType === 'tag_subscription') {
      onConfirm({ description: payload.description, estimatedAmount: payload.estimatedAmount })
      return
    }
    onConfirm({
      title,
      targetAmount,
      type,
      categoryId: payload.categoryId ?? null,
      deadline: deadline || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={open => !open && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{ACTION_LABELS[actionType]}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {actionType === 'tag_subscription' ? (
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm space-y-1">
              <p className="font-medium">{payload.description as string}</p>
              <p className="text-muted-foreground">
                Estimativa: R$ {Number(payload.estimatedAmount ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / mês
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Esta assinatura será marcada para revisão no seu painel.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Valor</Label>
                <CurrencyInput value={targetAmount} onChange={setTargetAmount} />
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spending_limit">Limite de Gasto</SelectItem>
                    <SelectItem value="savings_target">Meta de Economia</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Prazo (opcional)</Label>
                <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPending}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? 'Salvando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
