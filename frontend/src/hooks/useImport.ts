import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { ImportPreviewResult, ImportResult, ImportHistory, ParsedTransaction, FileType } from '../types'

export function useImportPreview() {
  return useMutation({
    mutationFn: async (formData: FormData): Promise<ImportPreviewResult> =>
      (await api.post('/import/preview', formData, { headers: { 'Content-Type': 'multipart/form-data' } })).data,
  })
}

export function useConfirmImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      accountId: string
      filename: string
      fileType: FileType
      transactions: ParsedTransaction[]
    }): Promise<ImportResult> => (await api.post('/import/confirm', data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['import', 'history'] })
    },
  })
}

export function useImportHistory() {
  return useQuery<ImportHistory[]>({
    queryKey: ['import', 'history'],
    queryFn: async () => (await api.get('/import/history')).data.history,
  })
}
