import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Landmark } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useLoans, useCreateLoan, useUpdateLoan, useDeleteLoan } from '@/hooks/useLoans'
import { useToast } from '@/hooks/useToast'
import { Loan, LoanStatus, AmortizationType } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { CurrencyInput } from '@/components/ui/currency-input'
import { formatCurrency } from '@/lib/utils'

const createSchema = z
  .object({
    name: z.string().min(1, 'Nome obrigatório'),
    lender: z.string().optional(),
    amortizationType: z.enum(['fixed', 'sac', 'price']),
    amountReceived: z.number().positive('Informe o valor recebido'),
    totalAmount: z.number(),
    // NaN when the input is empty; only validated for sac/price (field is hidden for fixed)
    ratePercent: z.number().or(z.nan()),
    ratePeriod: z.enum(['monthly', 'annual']),
    installmentsCount: z.number({ invalid_type_error: 'Informe o nº de parcelas' }).int().min(1, 'Mínimo 1 parcela'),
    startDate: z.string().min(1, 'Data obrigatória'),
    firstDueDate: z.string().min(1, 'Data obrigatória'),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.amortizationType === 'fixed') {
      if (data.totalAmount <= 0) {
        ctx.addIssue({ code: 'custom', message: 'Informe o valor total a pagar', path: ['totalAmount'] })
      } else if (data.totalAmount < data.amountReceived) {
        ctx.addIssue({ code: 'custom', message: 'O valor total não pode ser menor que o valor recebido', path: ['totalAmount'] })
      }
    } else if (Number.isNaN(data.ratePercent)) {
      ctx.addIssue({ code: 'custom', message: 'Informe a taxa', path: ['ratePercent'] })
    } else if (data.ratePercent < 0 || data.ratePercent > 100) {
      ctx.addIssue({ code: 'custom', message: 'Taxa inválida', path: ['ratePercent'] })
    }
  })
type CreateFormData = z.infer<typeof createSchema>

const CREATE_DEFAULTS: CreateFormData = {
  name: '', lender: '', amortizationType: 'fixed', amountReceived: 0, totalAmount: 0,
  ratePercent: 0, ratePeriod: 'annual', installmentsCount: 1, startDate: '', firstDueDate: '', notes: '',
}

const AMORTIZATION_LABEL: Record<AmortizationType, string> = {
  fixed: 'Parcelas fixas',
  sac: 'SAC',
  price: 'Tabela Price',
}

const AMORTIZATION_HINT: Record<AmortizationType, string> = {
  fixed: 'Você informa o total a pagar e ele é dividido em parcelas iguais.',
  sac: 'Amortização constante: parcelas decrescentes. Comum em financiamento imobiliário.',
  price: 'Parcelas iguais calculadas a partir da taxa de juros. Comum em financiamento de veículos.',
}

/** Converts the form rate (percent, monthly or effective annual) into a monthly fraction. */
function toMonthlyRate(ratePercent: number, period: 'monthly' | 'annual'): number {
  const rate = ratePercent / 100
  return period === 'monthly' ? rate : Math.pow(1 + rate, 1 / 12) - 1
}

/**
 * Client-side estimate of the schedule for the form preview only —
 * the backend (LoanCalculator) is the source of truth for the stored installments.
 */
function previewSchedule(type: 'sac' | 'price', principal: number, monthlyRate: number, n: number) {
  if (principal <= 0 || n < 1 || !Number.isFinite(monthlyRate)) return null
  if (type === 'sac') {
    const amortization = principal / n
    const first = amortization + principal * monthlyRate
    const last = amortization + amortization * monthlyRate
    const total = principal + monthlyRate * principal * (n + 1) / 2
    return { first, last, total }
  }
  const pmt = monthlyRate === 0 ? principal / n : (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n))
  return { first: pmt, last: pmt, total: pmt * n }
}

const editSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  lender: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['active', 'paid', 'cancelled']),
})
type EditFormData = z.infer<typeof editSchema>

const STATUS_LABEL: Record<LoanStatus, string> = { active: 'Ativo', paid: 'Quitado', cancelled: 'Cancelado' }
const STATUS_VARIANT: Record<LoanStatus, 'outline' | 'income' | 'secondary'> = {
  active: 'outline',
  paid: 'income',
  cancelled: 'secondary',
}

export default function LoansPage() {
  const { data: loans = [], isLoading } = useLoans()
  const createLoan = useCreateLoan()
  const updateLoan = useUpdateLoan()
  const deleteLoan = useDeleteLoan()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Loan | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Loan | null>(null)

  const createForm = useForm<CreateFormData>({
    resolver: zodResolver(createSchema),
    defaultValues: CREATE_DEFAULTS,
  })
  const editForm = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: '', lender: '', notes: '', status: 'active' },
  })

  function openCreate() {
    createForm.reset(CREATE_DEFAULTS)
    setCreateOpen(true)
  }

  function openEdit(loan: Loan) {
    editForm.reset({ name: loan.name, lender: loan.lender ?? '', notes: loan.notes ?? '', status: loan.status })
    setEditing(loan)
  }

  async function onCreate(data: CreateFormData) {
    const { amortizationType, totalAmount, ratePercent, ratePeriod, ...base } = data
    try {
      await createLoan.mutateAsync(
        amortizationType === 'fixed'
          ? { ...base, amortizationType, totalAmount }
          : { ...base, amortizationType, interestRate: toMonthlyRate(ratePercent, ratePeriod) },
      )
      toast({ title: 'Empréstimo cadastrado' })
      setCreateOpen(false)
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err?.response?.data?.message ?? 'Não foi possível cadastrar o empréstimo' })
    }
  }

  async function onEdit(data: EditFormData) {
    if (!editing) return
    try {
      await updateLoan.mutateAsync({ id: editing.id, ...data })
      toast({ title: 'Empréstimo atualizado' })
      setEditing(null)
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err?.response?.data?.message ?? 'Não foi possível atualizar o empréstimo' })
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteLoan.mutateAsync(deleteTarget.id)
      toast({ title: 'Empréstimo excluído' })
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível excluir o empréstimo' })
    } finally {
      setDeleteTarget(null)
    }
  }

  function renderLoanCard(loan: Loan) {
    return (
      <Card
        key={loan.id}
        className="cursor-pointer transition-colors hover:border-primary/50"
        onClick={() => navigate(`/loans/${loan.id}`)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="text-base">{loan.name}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {[loan.lender, loan.amortizationType !== 'fixed' && AMORTIZATION_LABEL[loan.amortizationType]]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
              <Badge variant={STATUS_VARIANT[loan.status]}>{STATUS_LABEL[loan.status]}</Badge>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(loan)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setDeleteTarget(loan)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Recebido</span>
            <span className="font-medium">{formatCurrency(loan.amountReceived)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total a pagar</span>
            <span className="font-medium">{formatCurrency(loan.totalAmount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Juros</span>
            <span className="font-medium text-expense">
              {formatCurrency(loan.totalInterest)} ({loan.interestPercentage.toFixed(1)}%)
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{loan.paidCount}/{loan.installmentsCount} parcelas</span>
              <span>{(loan.monthlyInterestRate * 100).toFixed(2)}% a.m.</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${loan.installmentsCount > 0 ? (loan.paidCount / loan.installmentsCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const amortizationType = createForm.watch('amortizationType')
  const watchedPrincipal = createForm.watch('amountReceived')
  const watchedRatePercent = createForm.watch('ratePercent')
  const watchedRatePeriod = createForm.watch('ratePeriod')
  const watchedCount = createForm.watch('installmentsCount')
  const preview =
    amortizationType === 'fixed'
      ? null
      : previewSchedule(
          amortizationType,
          watchedPrincipal,
          toMonthlyRate(watchedRatePercent, watchedRatePeriod),
          watchedCount,
        )

  const openLoans = loans.filter(l => l.status === 'active')
  // quitados first, cancelados (também encerrados) ao final
  const closedLoans = [
    ...loans.filter(l => l.status === 'paid'),
    ...loans.filter(l => l.status === 'cancelled'),
  ]
  const totalInterestActive = loans.filter(l => l.status === 'active').reduce((sum, l) => sum + l.totalInterest, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Empréstimos</h1>
          <p className="text-muted-foreground text-sm">
            Juros em andamento: <span className="font-medium text-expense">{formatCurrency(totalInterestActive)}</span>
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Empréstimo
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Card key={i} className="h-48 animate-pulse" />)}
        </div>
      ) : loans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <Landmark className="h-8 w-8 opacity-50" />
            <p>Nenhum empréstimo cadastrado ainda.</p>
            <Button variant="link" onClick={openCreate}>Cadastrar primeiro empréstimo</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">
              Em aberto <span className="text-sm font-normal text-muted-foreground">({openLoans.length})</span>
            </h2>
            {openLoans.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum empréstimo em aberto.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {openLoans.map(renderLoanCard)}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">
              Quitados <span className="text-sm font-normal text-muted-foreground">({closedLoans.length})</span>
            </h2>
            {closedLoans.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum empréstimo quitado.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {closedLoans.map(renderLoanCard)}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Empréstimo</DialogTitle>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(onCreate)}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input placeholder="Ex: Empréstimo pessoal, Financiamento..." {...createForm.register('name')} />
                {createForm.formState.errors.name && (
                  <p className="text-xs text-destructive">{createForm.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Credor (opcional)</Label>
                <Input placeholder="Ex: Nubank, Banco do Brasil..." {...createForm.register('lender')} />
              </div>
              <div className="space-y-2">
                <Label>Tipo de amortização</Label>
                <Select
                  value={amortizationType}
                  onValueChange={v => createForm.setValue('amortizationType', v as AmortizationType, { shouldValidate: true })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">{AMORTIZATION_LABEL.fixed}</SelectItem>
                    <SelectItem value="sac">{AMORTIZATION_LABEL.sac}</SelectItem>
                    <SelectItem value="price">{AMORTIZATION_LABEL.price}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{AMORTIZATION_HINT[amortizationType]}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{amortizationType === 'fixed' ? 'Valor recebido' : 'Valor financiado'}</Label>
                  <CurrencyInput
                    value={createForm.watch('amountReceived') ?? 0}
                    onChange={v => createForm.setValue('amountReceived', v, { shouldValidate: true })}
                  />
                  {createForm.formState.errors.amountReceived && (
                    <p className="text-xs text-destructive">{createForm.formState.errors.amountReceived.message}</p>
                  )}
                </div>
                {amortizationType === 'fixed' ? (
                  <div className="space-y-2">
                    <Label>Valor total a pagar</Label>
                    <CurrencyInput
                      value={createForm.watch('totalAmount') ?? 0}
                      onChange={v => createForm.setValue('totalAmount', v, { shouldValidate: true })}
                    />
                    {createForm.formState.errors.totalAmount && (
                      <p className="text-xs text-destructive">{createForm.formState.errors.totalAmount.message}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Taxa de juros (%)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.0001"
                        min={0}
                        className="min-w-0"
                        {...createForm.register('ratePercent', { valueAsNumber: true })}
                      />
                      <Select
                        value={createForm.watch('ratePeriod')}
                        onValueChange={v => createForm.setValue('ratePeriod', v as 'monthly' | 'annual')}
                      >
                        <SelectTrigger className="w-24 shrink-0"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="annual">a.a.</SelectItem>
                          <SelectItem value="monthly">a.m.</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {createForm.formState.errors.ratePercent && (
                      <p className="text-xs text-destructive">{createForm.formState.errors.ratePercent.message}</p>
                    )}
                  </div>
                )}
              </div>
              {preview && (
                <div className="rounded-md border border-border bg-muted/40 p-3 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">1ª parcela</span>
                    <span className="font-medium">{formatCurrency(preview.first)}</span>
                  </div>
                  {amortizationType === 'sac' && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Última parcela</span>
                      <span className="font-medium">{formatCurrency(preview.last)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total estimado</span>
                    <span className="font-medium">{formatCurrency(preview.total)}</span>
                  </div>
                  <p className="pt-1 text-muted-foreground">
                    {createForm.watch('ratePeriod') === 'annual' && 'Taxa anual tratada como efetiva. '}
                    Seguros e taxas não estão incluídos — ajuste o valor de cada parcela no detalhe do empréstimo.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Nº de parcelas</Label>
                  <Input
                    type="number"
                    min={1}
                    {...createForm.register('installmentsCount', { valueAsNumber: true })}
                  />
                  {createForm.formState.errors.installmentsCount && (
                    <p className="text-xs text-destructive">{createForm.formState.errors.installmentsCount.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Data de recebimento</Label>
                  <Input type="date" {...createForm.register('startDate')} />
                  {createForm.formState.errors.startDate && (
                    <p className="text-xs text-destructive">{createForm.formState.errors.startDate.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>1º vencimento</Label>
                  <Input type="date" {...createForm.register('firstDueDate')} />
                  {createForm.formState.errors.firstDueDate && (
                    <p className="text-xs text-destructive">{createForm.formState.errors.firstDueDate.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observações (opcional)</Label>
                <textarea
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  {...createForm.register('notes')}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createForm.formState.isSubmitting}>
                {createForm.formState.isSubmitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Empréstimo</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEdit)}>
            <div className="space-y-4 py-4">
              <p className="text-xs text-muted-foreground">
                O valor financiado, o tipo e o nº de parcelas não podem ser alterados após o cadastro. Para ajustar o valor ou o vencimento de uma parcela, use o detalhe do empréstimo.
              </p>
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input {...editForm.register('name')} />
                {editForm.formState.errors.name && (
                  <p className="text-xs text-destructive">{editForm.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Credor</Label>
                <Input {...editForm.register('lender')} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editForm.watch('status')}
                  onValueChange={v => editForm.setValue('status', v as LoanStatus)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="paid">Quitado</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <textarea
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  {...editForm.register('notes')}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button type="submit" disabled={editForm.formState.isSubmitting}>
                {editForm.formState.isSubmitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empréstimo?</AlertDialogTitle>
            <AlertDialogDescription>
              O empréstimo <strong>{deleteTarget?.name}</strong> e todas as suas parcelas serão excluídos permanentemente.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteLoan.isPending}>
              {deleteLoan.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
