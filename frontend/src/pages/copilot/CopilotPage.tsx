import { useState, useRef } from 'react'
import { BrainCircuit, RefreshCw, Sparkles, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { InsightCard } from './InsightCard'
import { useCopilotInsights, useAnalyze } from '@/hooks/useCopilot'
import { CopilotInsight } from '@/types'
import { formatDate } from '@/lib/utils'

export default function CopilotPage() {
  const { data: insights = [], isLoading, refetch } = useCopilotInsights()
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const streamRef = useRef<string>('')

  const analyze = useAnalyze(
    token => {
      streamRef.current += token
      setStreamText(streamRef.current)
    },
    (_insights: CopilotInsight[]) => {
      setStreaming(false)
      setStreamText('')
      streamRef.current = ''
      refetch()
    },
    (message: string) => {
      setStreaming(false)
      setStreamText('')
      streamRef.current = ''
      setErrorMsg(
        message === 'insufficient_data'
          ? 'Dados insuficientes. Importe pelo menos 2 meses de transações para ativar o Copilot.'
          : message.includes('minuto')
          ? message
          : 'Não foi possível gerar a análise. Tente novamente em instantes.',
      )
    },
  )

  async function handleAnalyze() {
    setErrorMsg(null)
    setStreaming(true)
    streamRef.current = ''
    setStreamText('')
    await analyze.mutateAsync()
  }

  const lastInsight = insights[0]
  const activeInsights = insights.filter(i => !i.actionTaken)
  const doneInsights = insights.filter(i => i.actionTaken)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Finance Copilot</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Análise inteligente do seu comportamento financeiro com ações diretas
          </p>
          {lastInsight && !streaming && (
            <p className="text-xs text-muted-foreground mt-1">
              Última análise: {formatDate(lastInsight.createdAt)}
            </p>
          )}
        </div>
        <Button
          onClick={handleAnalyze}
          disabled={streaming || analyze.isPending}
          className="gap-2 shrink-0"
        >
          {streaming ? (
            <><RefreshCw className="h-4 w-4 animate-spin" /> Analisando...</>
          ) : (
            <><Sparkles className="h-4 w-4" /> {insights.length > 0 ? 'Nova análise' : 'Analisar agora'}</>
          )}
        </Button>
      </div>

      {/* Error */}
      {errorMsg && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">{errorMsg}</CardContent>
        </Card>
      )}

      {/* Streaming preview */}
      {streaming && streamText && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3 text-primary text-sm font-medium">
              <BrainCircuit className="h-4 w-4 animate-pulse" />
              Gerando insights...
            </div>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
              {streamText}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Loading skeleton */}
      {isLoading && !streaming && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />)}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !streaming && insights.length === 0 && !errorMsg && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <BarChart3 className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Nenhuma análise ainda</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Clique em "Analisar agora" para o Copilot examinar seus dados financeiros
                e sugerir ações concretas.
              </p>
            </div>
            <Button onClick={handleAnalyze} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Analisar agora
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Active insights */}
      {activeInsights.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Recomendações ({activeInsights.length})
          </h2>
          {activeInsights.map(insight => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}

      {/* Done insights */}
      {doneInsights.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Concluídos ({doneInsights.length})
          </h2>
          {doneInsights.map(insight => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}
    </div>
  )
}
