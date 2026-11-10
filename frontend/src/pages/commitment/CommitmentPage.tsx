import { useMemo, useState } from 'react'
import { format, parse } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, AlertOctagon, Gauge, CalendarClock, RotateCcw, type LucideIcon } from 'lucide-react'
import { useCommitment } from '@/hooks/useReports'
import { CommitmentItem, CommitmentMonth, CommitmentSource } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { formatCurrency, formatDate, cn } from '@/lib/utils'

const INCOME_STORAGE_KEY = 'plutos:commitment-income'

const SOURCES: Record<CommitmentSource, { label: string; color: string }> = {
  installment: { label: 'Compras parceladas', color: '#6366f1' },
  loan: { label: 'Empréstimos', color: '#f97316' },
  expense: { label: 'Outras despesas', color: '#06b6d4' },
}
const SOURCE_ORDER: CommitmentSource[] = ['installment', 'loan', 'expense']

type Level = { label: string; color: string; Icon: LucideIcon; hint: string }

function levelFor(percentage: number): Level {
  if (percentage <= 30) return { label: 'Saudável', color: '#10b981', Icon: CheckCircle2, hint: 'até 30% da renda' }
  if (percentage <= 50) return { label: 'Atenção', color: '#f59e0b', Icon: AlertTriangle, hint: 'entre 30% e 50%' }
  return { label: percentage > 100 ? 'Acima da renda' : 'Crítico', color: '#ef4444', Icon: AlertOctagon, hint: 'acima de 50%' }
}

function monthLabel(month: string, pattern = 'MMM/yy') {
  return format(parse(month, 'yyyy-MM', new Date()), pattern, { locale: ptBR })
}

function readStoredIncome(): number | null {
  try {
    const raw = localStorage.getItem(INCOME_STORAGE_KEY)
    const value = raw ? Number(raw) : NaN
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

type ViewMonth = CommitmentMonth & { committed: number; percentage: number; free: number }

function LevelBadge({ percentage }: { percentage: number }) {
  const level = levelFor(percentage)
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{ borderColor: level.color, color: level.color, backgroundColor: `${level.color}18` }}
    >
      <level.Icon className="h-3 w-3" /> {level.label}
    </span>
  )
}

function SegmentedBar({ month, includeOther }: { month: ViewMonth; includeOther: boolean }) {
  const values: Record<CommitmentSource, number> = {
    installment: month.installmentExpenses,
    loan: month.loanInstallments,
    expense: includeOther ? month.otherExpenses : 0,
  }
  // Scale to whichever is larger, income or committed, so over-commitment stays visible
  const scale = Math.max(month.income, month.committed) || 1
  const incomeMark = month.income > 0 && month.committed > month.income ? (month.income / scale) * 100 : null
  return (
    <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
      <div className="flex h-full gap-[2px]">
        {SOURCE_ORDER.filter(s => values[s] > 0).map(s => (
          <div
            key={s}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(values[s] / scale) * 100}%`, backgroundColor: SOURCES[s].color }}
            title={`${SOURCES[s].label}: ${formatCurrency(values[s])}`}
          />
        ))}
      </div>
      {incomeMark !== null && (
        <div className="absolute top-0 h-full w-0.5 bg-foreground" style={{ left: `${incomeMark}%` }} title="Limite da renda" />
      )}
    </div>
  )
}

function ItemsList({ items }: { items: CommitmentItem[] }) {
  return (
    <div className="space-y-3 pt-3">
      {SOURCE_ORDER.map(source => {
        const group = items.filter(i => i.source === source)
        if (group.length === 0) return null
        const total = group.reduce((s, i) => s + i.amount, 0)
        return (
          <div key={source}>
            <div className="mb-1 flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SOURCES[source].color }} />
                {SOURCES[source].label}
              </span>
              <span>{formatCurrency(total)}</span>
            </div>
            <ul className="divide-y divide-border rounded-md border">
              {group.map(item => (
                <li key={`${item.source}-${item.id}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">
                      {item.description}
                      {(item.totalInstallments ?? 0) > 1 && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {item.installment}/{item.totalInstallments}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(item.date)}
                      {item.categoryName && ` · ${item.categoryName}`}
                      {item.paid && ' · paga'}
                    </p>
                  </div>
                  <span className="shrink-0 font-medium">{formatCurrency(item.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

type TooltipPayload = { payload: ViewMonth }

function ChartTooltip({ active, payload, includeOther }: { active?: boolean; payload?: TooltipPayload[]; includeOther: boolean }) {
  if (!active || !payload?.length) return null
  const m = payload[0].payload
  const level = levelFor(m.percentage)
  return (
    <div className="rounded-lg border bg-card p-3 text-xs shadow-md space-y-1 min-w-[200px]">
      <p className="text-sm font-semibold capitalize">{monthLabel(m.month, 'MMMM yyyy')}</p>
      <p className="flex justify-between gap-4"><span className="text-muted-foreground">Renda considerada</span>{formatCurrency(m.income)}</p>
      {SOURCE_ORDER.filter(s => s !== 'expense' || includeOther).map(s => {
        const v = s === 'installment' ? m.installmentExpenses : s === 'loan' ? m.loanInstallments : m.otherExpenses
        return (
          <p key={s} className="flex justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SOURCES[s].color }} /> {SOURCES[s].label}
            </span>
            {formatCurrency(v)}
          </p>
        )
      })}
      <p className="flex justify-between gap-4 border-t pt-1 font-medium">
        <span>Comprometido</span>
        <span style={{ color: level.color }}>{m.percentage.toFixed(0)}%</span>
      </p>
      <p className="flex justify-between gap-4"><span className="text-muted-foreground">Livre</span>{formatCurrency(m.free)}</p>
    </div>
  )
}

export default function CommitmentPage() {
  const [months, setMonths] = useState(12)
  const [includeOther, setIncludeOther] = useState(true)
  const [customIncome, setCustomIncome] = useState<number | null>(readStoredIncome)
  const [expanded, setExpanded] = useState<string | null>(null)
  const { data, isLoading } = useCommitment(months)

  function changeIncome(value: number) {
    const next = value > 0 ? value : null
    setCustomIncome(next)
    try {
      if (next) localStorage.setItem(INCOME_STORAGE_KEY, String(next))
      else localStorage.removeItem(INCOME_STORAGE_KEY)
    } catch { /* storage unavailable: keep in memory only */ }
  }

  const baseIncome = customIncome ?? data?.referenceIncome ?? 0

  const view: ViewMonth[] = useMemo(() => (data?.months ?? []).map(m => {
    const income = Math.max(m.scheduledIncome, baseIncome)
    const committed = m.installmentExpenses + m.loanInstallments + (includeOther ? m.otherExpenses : 0)
    return {
      ...m,
      income,
      committed,
      free: income - committed,
      percentage: income > 0 ? (committed / income) * 100 : 0,
      items: includeOther ? m.items : m.items.filter(i => i.source !== 'expense'),
    }
  }), [data, baseIncome, includeOther])

  const current = view[0]
  const next = view.slice(1)
  const avgNext = next.length ? next.reduce((s, m) => s + m.percentage, 0) / next.length : 0
  const peak = view.reduce<ViewMonth | null>((p, m) => (!p || m.percentage > p.percentage ? m : p), null)
  const totalCommitted = view.reduce((s, m) => s + m.committed, 0)

  const chartData = view.map(m => ({
    ...m,
    label: monthLabel(m.month),
    [SOURCES.installment.label]: m.installmentExpenses,
    [SOURCES.loan.label]: m.loanInstallments,
    [SOURCES.expense.label]: includeOther ? m.otherExpenses : 0,
    Renda: m.income,
  }))
  const stacked = SOURCE_ORDER.filter(s => s !== 'expense' || includeOther)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Comprometimento de Renda</h1>
          <p className="text-sm text-muted-foreground">
            Quanto da sua renda já está reservado para parcelas, empréstimos e despesas lançadas nos próximos meses.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Renda mensal considerada</Label>
            <div className="flex items-center gap-1">
              <CurrencyInput value={baseIncome} onChange={changeIncome} className="w-40" />
              {customIncome !== null && (
                <Button variant="ghost" size="icon" className="h-9 w-9" title="Voltar para a média automática" onClick={() => changeIncome(0)}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Horizonte</Label>
            <Select value={String(months)} onValueChange={v => setMonths(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[6, 12, 24, 36].map(n => <SelectItem key={n} value={String(n)}>{n} meses</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant={includeOther ? 'secondary' : 'outline'} onClick={() => setIncludeOther(v => !v)}>
            {includeOther ? 'Com despesas avulsas' : 'Só parcelas e empréstimos'}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {customIncome !== null
          ? 'Usando a renda informada por você.'
          : `Renda estimada pela média dos últimos ${data?.referenceMonths ?? 3} meses com receitas.`}{' '}
        Meses com receitas já lançadas acima desse valor usam a receita lançada.
      </p>

      {isLoading || !current ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Card key={i} className="h-28 animate-pulse" />)}
        </div>
      ) : (
        <>
          {baseIncome <= 0 && (
            <Card className="border-amber-500/50">
              <CardContent className="flex items-center gap-2 p-4 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Não encontramos receitas recentes. Informe sua renda mensal acima para calcular os percentuais.
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="space-y-2 p-4">
                <p className="text-xs text-muted-foreground capitalize">Este mês ({monthLabel(current.month, 'MMMM')})</p>
                <p className="text-3xl font-bold">{current.percentage.toFixed(0)}%</p>
                <div className="flex items-center justify-between gap-2">
                  <LevelBadge percentage={current.percentage} />
                  <span className="text-xs text-muted-foreground">{formatCurrency(current.committed)}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2 p-4">
                <p className="text-xs text-muted-foreground">Média dos próximos {next.length} meses</p>
                <p className="text-3xl font-bold">{avgNext.toFixed(0)}%</p>
                <LevelBadge percentage={avgNext} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2 p-4">
                <p className="flex items-center gap-1 text-xs text-muted-foreground"><Gauge className="h-3.5 w-3.5" /> Mês mais apertado</p>
                <p className="text-3xl font-bold capitalize">{peak ? monthLabel(peak.month) : '—'}</p>
                <p className="text-xs text-muted-foreground">
                  {peak ? `${peak.percentage.toFixed(0)}% · ${formatCurrency(peak.committed)}` : ''}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2 p-4">
                <p className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" /> Parcelas terminam em</p>
                <p className="text-3xl font-bold capitalize">
                  {data?.lastCommitmentMonth ? monthLabel(data.lastCommitmentMonth) : 'Nenhuma'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data?.lastCommitmentMonth === view[view.length - 1]?.month
                    ? 'ou depois do horizonte selecionado'
                    : `Total no período: ${formatCurrency(totalCommitted)}`}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Compromissos vs renda por mês</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    cursor={{ fill: '#94a3b815' }}
                    content={({ active, payload }) => (
                      <ChartTooltip active={active} payload={payload as unknown as TooltipPayload[]} includeOther={includeOther} />
                    )}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                  {stacked.map((s, i) => (
                    <Bar
                      key={s}
                      dataKey={SOURCES[s].label}
                      stackId="committed"
                      fill={SOURCES[s].color}
                      stroke="hsl(var(--card))"
                      strokeWidth={2}
                      radius={i === stacked.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                      maxBarSize={40}
                    />
                  ))}
                  <Line type="stepAfter" dataKey="Renda" stroke="#10b981" strokeWidth={2} strokeDasharray="6 4" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalhe mês a mês</CardTitle>
              <p className="text-xs text-muted-foreground">
                Saudável até 30% · Atenção entre 30% e 50% · Crítico acima de 50%. Clique em um mês para ver os lançamentos.
              </p>
            </CardHeader>
            <CardContent className="divide-y divide-border p-0">
              {view.map(m => {
                const open = expanded === m.month
                return (
                  <div key={m.month} className="px-6 py-3">
                    <button
                      className="flex w-full items-center gap-4 text-left"
                      onClick={() => setExpanded(open ? null : m.month)}
                    >
                      {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                      <span className="w-20 shrink-0 text-sm font-medium capitalize">{monthLabel(m.month)}</span>
                      <div className="flex-1"><SegmentedBar month={m} includeOther={includeOther} /></div>
                      <span className="w-12 shrink-0 text-right text-sm font-semibold">{m.percentage.toFixed(0)}%</span>
                      <span className="hidden w-32 shrink-0 text-right text-sm text-muted-foreground md:block">
                        {formatCurrency(m.committed)}
                      </span>
                      <span className={cn('hidden w-32 shrink-0 text-right text-sm lg:block', m.free < 0 ? 'text-expense' : 'text-income')}>
                        {m.free < 0 ? 'Falta ' : 'Livre '}{formatCurrency(Math.abs(m.free))}
                      </span>
                      <span className="hidden w-32 shrink-0 justify-end sm:flex"><LevelBadge percentage={m.percentage} /></span>
                    </button>
                    {open && (m.items.length > 0
                      ? <ItemsList items={m.items} />
                      : <p className="pt-3 text-sm text-muted-foreground">Nenhum compromisso lançado neste mês.</p>)}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
