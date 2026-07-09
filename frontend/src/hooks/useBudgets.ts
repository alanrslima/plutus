import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { Budget } from '../types'

export type CreateBudgetData = {
  categoryId: string
  amount: number
  month: number
  year: number
}

export type UpdateBudgetData = Partial<CreateBudgetData>

export function useBudgets(month: number, year: number) {
  return useQuery<Budget[]>({
    queryKey: ['budgets', month, year],
    queryFn: async () => (await api.get('/budgets', { params: { month, year } })).data.budgets,
  })
}

export function useCreateBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateBudgetData) => api.post('/budgets', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  })
}

export function useUpdateBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateBudgetData) => api.put(`/budgets/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  })
}

export function useDeleteBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/budgets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  })
}
