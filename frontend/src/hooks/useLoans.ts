import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { Loan, LoanStatus } from '../types'

type CreateLoanBase = {
  name: string
  lender?: string
  amountReceived: number
  installmentsCount: number
  startDate: string
  firstDueDate: string
  notes?: string
}

export type CreateLoanData =
  | (CreateLoanBase & { amortizationType: 'fixed'; totalAmount: number })
  /** interestRate: monthly rate as a fraction (0.01 = 1% a.m.) */
  | (CreateLoanBase & { amortizationType: 'sac' | 'price'; interestRate: number })

export type UpdateInstallmentData = {
  amount?: number
  dueDate?: string
}

export type UpdateLoanData = {
  name?: string
  lender?: string
  notes?: string
  status?: LoanStatus
}

export function useLoans() {
  return useQuery<Loan[]>({
    queryKey: ['loans'],
    queryFn: async () => (await api.get('/loans')).data.loans,
  })
}

export function useLoan(id: string | undefined) {
  return useQuery<Loan>({
    queryKey: ['loans', id],
    queryFn: async () => (await api.get(`/loans/${id}`)).data,
    enabled: !!id,
  })
}

export function useCreateLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateLoanData) => api.post('/loans', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['reports', 'commitment'] })
    },
  })
}

export function useUpdateLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateLoanData) => api.put(`/loans/${id}`, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['loans', id] })
      qc.invalidateQueries({ queryKey: ['reports', 'commitment'] })
    },
  })
}

export function useDeleteLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/loans/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['reports', 'commitment'] })
    },
  })
}

export function useUpdateInstallment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ installmentId, ...data }: { installmentId: string } & UpdateInstallmentData) =>
      api.patch(`/loans/installments/${installmentId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['reports', 'commitment'] })
    },
  })
}

export function usePayInstallment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (installmentId: string) => api.patch(`/loans/installments/${installmentId}/pay`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['reports', 'commitment'] })
    },
  })
}

export function useUnpayInstallment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (installmentId: string) => api.patch(`/loans/installments/${installmentId}/unpay`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['reports', 'commitment'] })
    },
  })
}
