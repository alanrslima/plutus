import { useState, useRef, useCallback } from 'react'
import { Upload, FileText } from 'lucide-react'
import { useAccounts } from '@/hooks/useAccounts'
import { useImportPreview, useConfirmImport, useImportHistory } from '@/hooks/useImport'
import { useToast } from '@/hooks/useToast'
import { ImportPreviewResult, ParsedTransaction, ImportHistory } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/utils'

function StatusBadge({ status }: { status: ImportHistory['status'] }) {
  if (status === 'SUCCESS') return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Sucesso</Badge>
  if (status === 'PARTIAL') return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Parcial</Badge>
  return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Falhou</Badge>
}

function TypeBadge({ type }: { type: ParsedTransaction['type'] }) {
  if (type === 'income')
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Receita</Badge>
  return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Despesa</Badge>
}

export default function ImportPage() {
  const { data: accounts = [] } = useAccounts()
  const { data: history = [], isLoading: historyLoading } = useImportHistory()
  const importPreview = useImportPreview()
  const confirmImport = useConfirmImport()
  const { toast } = useToast()

  const [accountId, setAccountId] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (file: File | null) => {
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'ofx' && ext !== 'csv') {
      toast({ variant: 'destructive', title: 'Formato inválido', description: 'Apenas arquivos .ofx e .csv são aceitos.' })
      return
    }
    setSelectedFile(file)
  }

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileChange(e.target.files?.[0] ?? null)
  }

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileChange(e.dataTransfer.files?.[0] ?? null)
  }, [])

  async function handlePreview() {
    if (!accountId) {
      toast({ variant: 'destructive', title: 'Conta obrigatória', description: 'Selecione uma conta antes de importar.' })
      return
    }
    if (!selectedFile) {
      toast({ variant: 'destructive', title: 'Arquivo obrigatório', description: 'Selecione um arquivo para importar.' })
      return
    }
    const formData = new FormData()
    formData.append('file', selectedFile)
    formData.append('accountId', accountId)
    try {
      const result = await importPreview.mutateAsync(formData)
      setPreviewResult(result)
      setPreviewOpen(true)
    } catch {
      toast({ variant: 'destructive', title: 'Erro na pré-visualização', description: 'Não foi possível processar o arquivo.' })
    }
  }

  async function handleConfirm() {
    if (!previewResult || !selectedFile || !accountId) return
    try {
      const result = await confirmImport.mutateAsync({
        accountId,
        filename: selectedFile.name,
        fileType: previewResult.fileType,
        transactions: previewResult.transactions,
      })
      toast({
        title: 'Importação concluída',
        description: `${result.importedCount} transações importadas, ${result.skippedCount} ignoradas.`,
      })
      setPreviewOpen(false)
      setPreviewResult(null)
      setSelectedFile(null)
      setAccountId('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch {
      toast({ variant: 'destructive', title: 'Erro na importação', description: 'Não foi possível confirmar a importação.' })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Importar Transações</h1>
        <p className="text-muted-foreground text-sm">Importe extratos bancários nos formatos OFX ou CSV.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle>Importar Arquivo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Conta</label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma conta..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer ${
                isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-accent/50'
              }`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".ofx,.csv"
                className="hidden"
                onChange={onFileInputChange}
              />
              {selectedFile ? (
                <div className="flex flex-col items-center gap-2 text-center">
                  <FileText className="h-8 w-8 text-primary" />
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">Clique para trocar o arquivo</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-center">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Arraste um arquivo aqui</p>
                  <p className="text-xs text-muted-foreground">ou clique para selecionar</p>
                  <p className="text-xs text-muted-foreground">Aceita .ofx e .csv</p>
                </div>
              )}
            </div>

            <Button
              className="w-full gap-2"
              onClick={handlePreview}
              disabled={importPreview.isPending}
            >
              <Upload className="h-4 w-4" />
              {importPreview.isPending ? 'Processando...' : 'Pré-visualizar'}
            </Button>
          </CardContent>
        </Card>

        {/* Import History Card */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Importações</CardTitle>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-10 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma importação realizada ainda.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-3 font-medium">Data</th>
                      <th className="pb-2 pr-3 font-medium">Arquivo</th>
                      <th className="pb-2 pr-3 font-medium">Conta</th>
                      <th className="pb-2 pr-3 font-medium text-right">Import.</th>
                      <th className="pb-2 pr-3 font-medium text-right">Ignor.</th>
                      <th className="pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(item => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 whitespace-nowrap">{formatDate(item.createdAt)}</td>
                        <td className="py-2 pr-3 max-w-[120px] truncate" title={item.filename}>{item.filename}</td>
                        <td className="py-2 pr-3 max-w-[100px] truncate" title={item.accountName}>{item.accountName ?? '—'}</td>
                        <td className="py-2 pr-3 text-right">{item.importedCount}</td>
                        <td className="py-2 pr-3 text-right">{item.skippedCount}</td>
                        <td className="py-2"><StatusBadge status={item.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Pré-visualização — {previewResult?.total ?? 0} transações encontradas
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-96 overflow-y-auto">
            {previewResult && previewResult.transactions.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Data</th>
                    <th className="pb-2 pr-3 font-medium">Descrição</th>
                    <th className="pb-2 pr-3 font-medium">Tipo</th>
                    <th className="pb-2 font-medium text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {previewResult.transactions.map(tx => (
                    <tr key={tx.externalId} className="border-b last:border-0">
                      <td className="py-2 pr-3 whitespace-nowrap">{formatDate(tx.date)}</td>
                      <td className="py-2 pr-3 max-w-[200px] truncate" title={tx.description}>{tx.description}</td>
                      <td className="py-2 pr-3"><TypeBadge type={tx.type} /></td>
                      <td className={`py-2 text-right font-medium ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma transação encontrada.</p>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            {previewResult?.transactions.length ?? 0} transações serão importadas
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={confirmImport.isPending || !previewResult?.transactions.length}
            >
              {confirmImport.isPending ? 'Importando...' : 'Confirmar Importação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
