import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Landmark } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useLoans, useCreateLoan, useUpdateLoan, useDeleteLoan } from '@/hooks/useLoans'
import { useToast } from '@/hooks/useToast'
import { Loan, LoanStatus } from '@/types'
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
    amountReceived: z.number().positive('Informe o valor recebido'),
    totalAmount: z.number().positive('Informe o valor total a pagar'),
    installmentsCount: z.number().int().min(1, 'Mínimo 1 parcela'),
    startDate: z.string().min(1, 'Data obrigatória'),
    firstDueDate: z.string().min(1, 'Data obrigatória'),
    notes: z.string().optional(),
  })
  .refine(data => data.totalAmount >= data.amountReceived, {
    message: 'O valor total não pode ser menor que o valor recebido',
    path: ['totalAmount'],
  })
type CreateFormData = z.infer<typeof createSchema>

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
    defaultValues: {
      name: '', lender: '', amountReceived: 0, totalAmount: 0,
      installmentsCount: 1, startDate: '', firstDueDate: '', notes: '',
    },
  })
  const editForm = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: '', lender: '', notes: '', status: 'active' },
  })

  function openCreate() {
    createForm.reset({
      name: '', lender: '', amountReceived: 0, totalAmount: 0,
      installmentsCount: 1, startDate: '', firstDueDate: '', notes: '',
    })
    setCreateOpen(true)
  }

  function openEdit(loan: Loan) {
    editForm.reset({ name: loan.name, lender: loan.lender ?? '', notes: loan.notes ?? '', status: loan.status })
    setEditing(loan)
  }

  async function onCreate(data: CreateFormData) {
    try {
      await createLoan.mutateAsync(data)
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loans.map(loan => (
            <Card
              key={loan.id}
              className="cursor-pointer transition-colors hover:border-primary/50"
              onClick={() => navigate(`/loans/${loan.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base">{loan.name}</CardTitle>
                    {loan.lender && <p className="text-xs text-muted-foreground">{loan.lender}</p>}
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
          ))}
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor recebido</Label>
                  <CurrencyInput
                    value={createForm.watch('amountReceived') ?? 0}
                    onChange={v => createForm.setValue('amountReceived', v, { shouldValidate: true })}
                  />
                  {createForm.formState.errors.amountReceived && (
                    <p className="text-xs text-destructive">{createForm.formState.errors.amountReceived.message}</p>
                  )}
                </div>
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
              </div>
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
                Valores e parcelas não podem ser alterados após o cadastro. Para corrigir esses dados, exclua e recadastre o empréstimo.
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
