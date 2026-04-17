import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { CopilotInsight } from '../types'

export function useCopilotInsights() {
  return useQuery<CopilotInsight[]>({
    queryKey: ['copilot', 'insights'],
    queryFn: async () => (await api.get('/copilot/insights')).data.insights,
  })
}

export function useDismissInsight() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.patch(`/copilot/insights/${id}/dismiss`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['copilot', 'insights'] }),
  })
}

export function useExecuteAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ insightId, payload }: { insightId: string; payload?: Record<string, unknown> }) =>
      api.post('/copilot/action', { insightId, payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['copilot', 'insights'] })
      qc.invalidateQueries({ queryKey: ['goals'] })
    },
  })
}

export function useAnalyze(
  onToken: (token: string) => void,
  onDone: (insights: CopilotInsight[]) => void,
  onError: (message: string, code: number) => void,
) {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('plutos:token')
      const resp = await fetch('/api/copilot/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      if (!resp.ok || !resp.body) {
        const text = await resp.text()
        throw new Error(text || 'Erro ao iniciar análise')
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (line.startsWith('event: ')) continue
          if (!line.startsWith('data: ')) continue
          const json = line.slice(6).trim()
          if (!json) continue

          let parsed: { token?: string; insights?: CopilotInsight[]; message?: string; code?: number }
          try { parsed = JSON.parse(json) } catch { continue }

          if ('token' in parsed && parsed.token !== undefined) {
            onToken(parsed.token)
          } else if ('insights' in parsed && parsed.insights) {
            onDone(parsed.insights)
            qc.invalidateQueries({ queryKey: ['copilot', 'insights'] })
          } else if ('message' in parsed) {
            onError(parsed.message ?? 'Erro desconhecido', parsed.code ?? 500)
          }
        }
      }
    },
  })
}
