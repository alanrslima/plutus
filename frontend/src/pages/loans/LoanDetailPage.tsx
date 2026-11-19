import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Circle, AlertTriangle, Pencil } from 'lucide-react'
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useLoan, usePayInstallment, useUnpayInstallment, useUpdateInstallment } from '@/hooks/useLoans'
import { useToast } from '@/hooks/useToast'
import { AmortizationType, LoanInstallment, LoanStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { CurrencyInput } from '@/components/ui/currency-input'
import { formatCurrency, formatDate, cn } from '@/lib/utils'

const installmentSchema = z.object({
  amount: z.number().positive('Informe o valor da parcela'),
  dueDate: z.string().min(1, 'Data obrigatória'),
})
type InstallmentFormData = z.infer<typeof installmentSchema>

const AMORTIZATION_LABEL: Record<AmortizationType, string> = {
  fixed: 'Parcelas fixas',
  sac: 'SAC',
  price: 'Tabela Price',
}

const STATUS_LABEL: Record<LoanStatus, string> = { active: 'Ativo', paid: 'Quitado', cancelled: 'Cancelado' }
const STATUS_VARIANT: Record<LoanStatus, 'outline' | 'income' | 'secondary'> = {
  active: 'outline',
  paid: 'income',
  cancelled: 'secondary',
}

export default function LoanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: loan, isLoading } = useLoan(id)
  const payInstallment = usePayInstallment()
  const unpayInstallment = useUnpayInstallment()
  const updateInstallment = useUpdateInstallment()
  const { toast } = useToast()

  const [editingInstallment, setEditingInstallment] = useState<LoanInstallment | null>(null)
  const installmentForm = useForm<InstallmentFormData>({
    resolver: zodResolver(installmentSchema),
    defaultValues: { amount: 0, dueDate: '' },
  })

  function openEditInstallment(installment: LoanInstallment) {
    installmentForm.reset({ amount: installment.amount, dueDate: installment.dueDate.slice(0, 10) })
    setEditingInstallment(installment)
  }

  async function onEditInstallment(data: InstallmentFormData) {
    if (!editingInstallment) return
    try {
      await updateInstallment.mutateAsync({ installmentId: editingInstallment.id, ...data })
      toast({ title: 'Parcela atualizada' })
      setEditingInstallment(null)
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast({ variant: 'destructive', title: 'Erro', description: message ?? 'Não foi possível atualizar a parcela' })
    }
  }

  async function togglePaid(installmentId: string, paid: boolean) {
    try {
      if (paid) {
        await unpayInstallment.mutateAsync(installmentId)
        toast({ title: 'Parcela marcada como pendente' })
      } else {
        await payInstallment.mutateAsync(installmentId)
        toast({ title: 'Parcela marcada como paga' })
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar a parcela' })
    }
  }

  if (isLoading || !loan) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Card key={i} className="h-24 animate-pulse" />)}
        </div>
      </div>
    )
  }

  const pieData = [
    { name: 'Valor recebido', value: loan.amountReceived, color: '#6366f1' },
    { name: 'Juros', value: loan.totalInterest, color: '#ef4444' },
  ]
  const today = new Date()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/loans')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{loan.name}</h1>
            <Badge variant={STATUS_VARIANT[loan.status]}>{STATUS_LABEL[loan.status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {[loan.lender, AMORTIZATION_LABEL[loan.amortizationType]].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Valor recebido</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{formatCurrency(loan.amountReceived)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total a pagar</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{formatCurrency(loan.totalAmount)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Juros total</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-expense">{formatCurrency(loan.totalInterest)}</p>
            <p className="text-xs text-muted-foreground">{loan.interestPercentage.toFixed(1)}% sobre o valor recebido</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Taxa de juros</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{(loan.monthlyInterestRate * 100).toFixed(2)}% a.m.</p>
            <p className="text-xs text-muted-foreground">{(loan.annualInterestRate * 100).toFixed(2)}% a.a. (equivalente)</p>
            {loan.interestRate !== undefined && Math.abs(loan.interestRate - loan.monthlyInterestRate) > 0.00001 && (
              <p className="text-xs text-muted-foreground">
                Contratual: {(loan.interestRate * 100).toFixed(4)}% a.m. — a taxa efetiva inclui os ajustes nas parcelas
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">Composição do valor pago</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Legend formatter={v => <span style={{ color: '#94a3b8', fontSize: 12 }}>{v}</span>} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: 8 }}
                  formatter={(v: number) => formatCurrency(v)}
                  itemStyle={{ color: '#fff' }}
                  labelStyle={{ color: '#aaa' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-muted-foreground">Pago até agora</span>
              <span className="font-medium">{formatCurrency(loan.paidAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Restante a pagar</span>
              <span className="font-medium">{formatCurrency(loan.remainingAmount)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Parcelas ({loan.paidCount}/{loan.installmentsCount} pagas)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-6 py-2 font-medium">Nº</th>
                    <th className="px-6 py-2 font-medium">Vencimento</th>
                    <th className="px-6 py-2 font-medium">Valor</th>
                    <th className="px-6 py-2 font-medium">Capital</th>
                    <th className="px-6 py-2 font-medium">Juros</th>
                    <th className="px-6 py-2 font-medium">Status</th>
                    <th className="px-6 py-2 font-medium text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {loan.installments.map(installment => {
                    const overdue = !installment.paid && new Date(installment.dueDate) < today
                    return (
                      <tr key={installment.id} className="border-b border-border last:border-0">
                        <td className="px-6 py-2.5">{installment.number}</td>
                        <td className="px-6 py-2.5">{formatDate(installment.dueDate)}</td>
                        <td className="px-6 py-2.5 font-medium">{formatCurrency(installment.amount)}</td>
                        <td className="px-6 py-2.5">{formatCurrency(installment.principal)}</td>
                        <td className="px-6 py-2.5 text-expense">{formatCurrency(installment.interest)}</td>
                        <td className="px-6 py-2.5">
                          {installment.paid ? (
                            <Badge variant="income" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Paga</Badge>
                          ) : overdue ? (
                            <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Atrasada</Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1"><Circle className="h-3 w-3" /> Pendente</Badge>
                          )}
                        </td>
                        <td className="px-6 py-2.5 text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Editar parcela"
                            onClick={() => openEditInstallment(installment)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn('text-xs', installment.paid && 'text-muted-foreground')}
                            onClick={() => togglePaid(installment.id, installment.paid)}
                          >
                            {installment.paid ? 'Desmarcar' : 'Marcar como paga'}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editingInstallment} onOpenChange={open => !open && setEditingInstallment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar parcela {editingInstallment?.number}/{loan.installmentsCount}</DialogTitle>
          </DialogHeader>
          <form onSubmit={installmentForm.handleSubmit(onEditInstallment)}>
            <div className="space-y-4 py-4">
              <p className="text-xs text-muted-foreground">
                Use para refletir o valor real do boleto (seguros, taxas, correção). O total, a taxa efetiva e a
                divisão entre capital e juros são recalculados.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor</Label>
                  <CurrencyInput
                    value={installmentForm.watch('amount') ?? 0}
                    onChange={v => installmentForm.setValue('amount', v, { shouldValidate: true })}
                  />
                  {installmentForm.formState.errors.amount && (
                    <p className="text-xs text-destructive">{installmentForm.formState.errors.amount.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Vencimento</Label>
                  <Input type="date" {...installmentForm.register('dueDate')} />
                  {installmentForm.formState.errors.dueDate && (
                    <p className="text-xs text-destructive">{installmentForm.formState.errors.dueDate.message}</p>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingInstallment(null)}>Cancelar</Button>
              <Button type="submit" disabled={installmentForm.formState.isSubmitting}>
                {installmentForm.formState.isSubmitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
