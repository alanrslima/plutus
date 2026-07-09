import { useState } from 'react'
import { Plus, Pencil, Trash2, PiggyBank, AlertTriangle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useBudgets, useCreateBudget, useUpdateBudget, useDeleteBudget } from '@/hooks/useBudgets'
import { useCategories } from '@/hooks/useCategories'
import { useToast } from '@/hooks/useToast'
import { Budget } from '@/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { CurrencyInput } from '@/components/ui/currency-input'
import { MonthSelector } from '@/components/ui/month-selector'
import { formatCurrency, cn } from '@/lib/utils'

const formSchema = z.object({
  categoryId: z.string().min(1, 'Selecione uma categoria'),
  amount: z.number().positive('Informe um valor maior que zero'),
})
type FormData = z.infer<typeof formSchema>

function progressColor(percentage: number) {
  if (percentage >= 100) return '#ef4444'
  if (percentage >= 80) return '#f59e0b'
  return '#10b981'
}

export default function BudgetsPage() {
  const [period, setPeriod] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  })

  const { data: budgets = [], isLoading } = useBudgets(period.month, period.year)
  const { data: expenseCategories = [] } = useCategories('expense')
  const createBudget = useCreateBudget()
  const updateBudget = useUpdateBudget()
  const deleteBudget = useDeleteBudget()
  const { toast } = useToast()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Budget | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { categoryId: '', amount: 0 },
  })

  const budgetedCategoryIds = new Set(budgets.map(b => b.categoryId))
  const availableCategories = editing
    ? expenseCategories
    : expenseCategories.filter(c => !budgetedCategoryIds.has(c.id))

  function openCreate() {
    setEditing(null)
    form.reset({ categoryId: '', amount: 0 })
    setDialogOpen(true)
  }

  function openEdit(budget: Budget) {
    setEditing(budget)
    form.reset({ categoryId: budget.categoryId, amount: budget.amount })
    setDialogOpen(true)
  }

  async function onSubmit(data: FormData) {
    try {
      if (editing) {
        await updateBudget.mutateAsync({ id: editing.id, ...data })
        toast({ title: 'Orçamento atualizado' })
      } else {
        await createBudget.mutateAsync({ ...data, month: period.month, year: period.year })
        toast({ title: 'Orçamento criado' })
      }
      setDialogOpen(false)
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err?.response?.data?.message ?? 'Não foi possível salvar o orçamento' })
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteBudget.mutateAsync(deleteTarget.id)
      toast({ title: 'Orçamento excluído' })
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível excluir o orçamento' })
    } finally {
      setDeleteTarget(null)
    }
  }

  const totalBudgeted = budgets.reduce((sum, b) => sum + b.amount, 0)
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0)
  const totalRemaining = totalBudgeted - totalSpent

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Orçamentos</h1>
          <p className="text-muted-foreground text-sm">Planeje seus gastos por categoria e acompanhe o progresso mensal.</p>
        </div>
        <div className="flex items-center gap-2">
          <MonthSelector value={period} onChange={setPeriod} />
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Orçamento
          </Button>
        </div>
      </div>

      {budgets.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total orçado</p>
              <p className="text-xl font-bold">{formatCurrency(totalBudgeted)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total gasto</p>
              <p className="text-xl font-bold text-expense">{formatCurrency(totalSpent)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Saldo do período</p>
              <p className={cn('text-xl font-bold', totalRemaining < 0 ? 'text-expense' : 'text-income')}>
                {formatCurrency(totalRemaining)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Card key={i} className="h-40 animate-pulse" />)}
        </div>
      ) : budgets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <PiggyBank className="h-8 w-8 opacity-50" />
            <p>Nenhum orçamento cadastrado para este período.</p>
            <Button variant="link" onClick={openCreate}>Criar primeiro orçamento</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {budgets.map(budget => {
            const color = progressColor(budget.percentage)
            const overBudget = budget.percentage >= 100
            return (
              <Card key={budget.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full border font-medium truncate"
                        style={{
                          borderColor: budget.categoryColor ?? undefined,
                          color: budget.categoryColor ?? undefined,
                          backgroundColor: budget.categoryColor ? `${budget.categoryColor}18` : undefined,
                        }}
                      >
                        {budget.categoryName}
                      </span>
                      {overBudget && (
                        <span className="flex items-center gap-1 text-xs font-medium text-expense shrink-0">
                          <AlertTriangle className="h-3.5 w-3.5" /> Estourado
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(budget)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(budget)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Gasto</span>
                    <span className="font-medium">{formatCurrency(budget.spent)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Orçado</span>
                    <span className="font-medium">{formatCurrency(budget.amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{overBudget ? 'Excedente' : 'Restante'}</span>
                    <span className="font-medium" style={{ color: overBudget ? '#ef4444' : undefined }}>
                      {formatCurrency(Math.abs(budget.remaining))}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(budget.percentage, 100)}%`, backgroundColor: color }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-right">{budget.percentage.toFixed(0)}% utilizado</p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Orçamento' : 'Novo Orçamento'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-4 py-4">
              {!editing && (
                <p className="text-xs text-muted-foreground">
                  Orçamento para {String(period.month).padStart(2, '0')}/{period.year}.
                </p>
              )}
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={form.watch('categoryId')}
                  onValueChange={v => form.setValue('categoryId', v, { shouldValidate: true })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
                  <SelectContent>
                    {availableCategories.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        Todas as categorias de despesa já têm orçamento neste período.
                      </div>
                    ) : (
                      availableCategories.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {form.formState.errors.categoryId && (
                  <p className="text-xs text-destructive">{form.formState.errors.categoryId.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Valor do orçamento</Label>
                <CurrencyInput
                  value={form.watch('amount') ?? 0}
                  onChange={v => form.setValue('amount', v, { shouldValidate: true })}
                />
                {form.formState.errors.amount && (
                  <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir orçamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O orçamento de <strong>{deleteTarget?.categoryName}</strong> será excluído permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteBudget.isPending}>
              {deleteBudget.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
