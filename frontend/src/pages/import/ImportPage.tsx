import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, Sparkles, X, Loader2 } from 'lucide-react'
import { useAccounts } from '@/hooks/useAccounts'
import { useImportPreview, useConfirmImport, useImportHistory, useAICategorize } from '@/hooks/useImport'
import { useCategories } from '@/hooks/useCategories'
import { useToast } from '@/hooks/useToast'
import { ImportPreviewResult, ParsedTransaction, ImportHistory } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/utils'

// Enriched transaction that tracks which file it came from
type EnrichedTransaction = ParsedTransaction & { _filename: string }

type FilePreview = {
  file: File
  result: ImportPreviewResult
}

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

function truncateName(name: string, max = 28) {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name
}

export default function ImportPage() {
  const { data: accounts = [] } = useAccounts()
  const { data: history = [], isLoading: historyLoading } = useImportHistory()
  const { data: categories = [] } = useCategories()
  const importPreview = useImportPreview()
  const confirmImport = useConfirmImport()
  const aiCategorize = useAICategorize()
  const { toast } = useToast()

  const [accountId, setAccountId] = useState<string>('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false)
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([])
  const [mergedTransactions, setMergedTransactions] = useState<EnrichedTransaction[]>([])
  const [categorySelections, setCategorySelections] = useState<Record<string, string | null>>({})
  const [aiEnabled, setAiEnabled] = useState(false)
  const [processingFiles, setProcessingFiles] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── File management ────────────────────────────────────────

  function addFiles(incoming: FileList | File[]) {
    const valid: File[] = []
    const invalid: string[] = []
    for (const file of Array.from(incoming)) {
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (ext === 'ofx' || ext === 'csv') {
        // Deduplicate by name
        if (!selectedFiles.some(f => f.name === file.name)) valid.push(file)
      } else {
        invalid.push(file.name)
      }
    }
    if (invalid.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Formato inválido',
        description: `${invalid.join(', ')} — apenas .ofx e .csv são aceitos.`,
      })
    }
    if (valid.length > 0) setSelectedFiles(prev => [...prev, ...valid])
  }

  function removeFile(name: string) {
    setSelectedFiles(prev => prev.filter(f => f.name !== name))
  }

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files)
    e.target.value = ''
  }

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }, [])
  const onDragLeave = useCallback(() => setIsDragging(false), [])
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files)
  }, [selectedFiles])

  // ── Preview ────────────────────────────────────────────────

  function resetDialogState() {
    setCategorySelections({})
    setAiEnabled(false)
    setFilePreviews([])
    setMergedTransactions([])
  }

  async function handlePreview() {
    if (!accountId) {
      toast({ variant: 'destructive', title: 'Conta obrigatória', description: 'Selecione uma conta antes de importar.' })
      return
    }
    if (selectedFiles.length === 0) {
      toast({ variant: 'destructive', title: 'Arquivo obrigatório', description: 'Selecione pelo menos um arquivo.' })
      return
    }

    setProcessingFiles(true)
    const previews: FilePreview[] = []
    const failed: string[] = []

    for (const file of selectedFiles) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('accountId', accountId)
      try {
        const result = await importPreview.mutateAsync(formData)
        previews.push({ file, result })
      } catch {
        failed.push(file.name)
      }
    }

    setProcessingFiles(false)

    if (failed.length > 0) {
      toast({
        variant: 'destructive',
        title: `${failed.length} arquivo(s) falharam`,
        description: failed.join(', '),
      })
    }

    if (previews.length === 0) return

    // Merge all transactions, tagging each with its filename
    const merged: EnrichedTransaction[] = previews.flatMap(p =>
      p.result.transactions.map(tx => ({ ...tx, _filename: p.file.name }))
    )

    const initial: Record<string, string | null> = {}
    merged.forEach(tx => { initial[tx.externalId] = null })

    setFilePreviews(previews)
    setMergedTransactions(merged)
    setCategorySelections(initial)
    setAiEnabled(false)
    setPreviewOpen(true)
  }

  // ── Confirm ────────────────────────────────────────────────

  async function handleConfirm() {
    if (filePreviews.length === 0 || !accountId) return

    let totalImported = 0
    let totalSkipped = 0
    const errors: string[] = []

    for (const { file, result } of filePreviews) {
      const txForFile = mergedTransactions
        .filter(tx => tx._filename === file.name)
        .map(tx => {
          const sel = categorySelections[tx.externalId]
          return { ...tx, categoryId: sel && sel !== '__none__' ? sel : null }
        })

      try {
        const res = await confirmImport.mutateAsync({
          accountId,
          filename: file.name,
          fileType: result.fileType,
          transactions: txForFile,
        })
        totalImported += res.importedCount
        totalSkipped += res.skippedCount
      } catch {
        errors.push(file.name)
      }
    }

    if (errors.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Falha em alguns arquivos',
        description: errors.join(', '),
      })
    }

    if (totalImported > 0 || totalSkipped > 0) {
      toast({
        title: 'Importação concluída',
        description: `${totalImported} transações importadas, ${totalSkipped} ignoradas.`,
      })
    }

    setPreviewOpen(false)
    setSelectedFiles([])
    resetDialogState()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── AI categorize ─────────────────────────────────────────

  async function handleAICategorize() {
    if (mergedTransactions.length === 0) return
    try {
      const result = await aiCategorize.mutateAsync(mergedTransactions)
      // Build suggestion lookup — backend returns ParsedTransaction[] without _filename
      const suggestionMap = new Map(
        result.transactions.map(tx => [tx.externalId, tx.suggestedCategoryId ?? null])
      )
      // Merge suggestions back preserving _filename on each enriched transaction
      const enriched: EnrichedTransaction[] = mergedTransactions.map(tx => ({
        ...tx,
        suggestedCategoryId: suggestionMap.has(tx.externalId)
          ? (suggestionMap.get(tx.externalId) ?? undefined)
          : tx.suggestedCategoryId,
      }))
      setMergedTransactions(enriched)
      setAiEnabled(true)
      const updated: Record<string, string | null> = {}
      enriched.forEach(tx => { updated[tx.externalId] = tx.suggestedCategoryId ?? null })
      setCategorySelections(updated)
    } catch {
      toast({ variant: 'destructive', title: 'Erro na categorização', description: 'Não foi possível categorizar com IA.' })
    }
  }

  function handleAcceptAllSuggestions() {
    const updated: Record<string, string | null> = {}
    mergedTransactions.forEach(tx => { updated[tx.externalId] = tx.suggestedCategoryId ?? null })
    setCategorySelections(updated)
  }

  function handleDialogOpenChange(open: boolean) {
    setPreviewOpen(open)
    if (!open) resetDialogState()
  }

  const hasAnySuggestions = mergedTransactions.some(tx => tx.suggestedCategoryId)
  const multipleFiles = filePreviews.length > 1

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
                    <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Drop zone */}
            <div
              className={`rounded-lg border-2 border-dashed transition-colors cursor-pointer ${
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
                multiple
                className="hidden"
                onChange={onFileInputChange}
              />

              {selectedFiles.length === 0 ? (
                <div className="flex flex-col items-center gap-2 p-8 text-center">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Arraste arquivos aqui</p>
                  <p className="text-xs text-muted-foreground">ou clique para selecionar</p>
                  <p className="text-xs text-muted-foreground">Aceita múltiplos .ofx e .csv</p>
                </div>
              ) : (
                <div className="p-4 space-y-2" onClick={e => e.stopPropagation()}>
                  {selectedFiles.map(file => (
                    <div
                      key={file.name}
                      className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-primary" />
                      <span className="flex-1 text-sm truncate" title={file.name}>
                        {truncateName(file.name)}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {(file.size / 1024).toFixed(0)} KB
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(file.name)}
                        className="ml-1 rounded p-0.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                  >
                    <Upload className="h-3 w-3" />
                    Adicionar mais arquivos
                  </button>
                </div>
              )}
            </div>

            <Button
              className="w-full gap-2"
              onClick={handlePreview}
              disabled={importPreview.isPending || processingFiles}
            >
              {processingFiles ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Processando arquivos...</>
              ) : (
                <><Upload className="h-4 w-4" /> Pré-visualizar</>
              )}
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
                {[1, 2, 3].map(i => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)}
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
      <Dialog open={previewOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Pré-visualização — {mergedTransactions.length} transações
              {multipleFiles && ` de ${filePreviews.length} arquivos`}
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-96 overflow-y-auto">
            {mergedTransactions.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Data</th>
                    <th className="pb-2 pr-3 font-medium">Descrição</th>
                    {multipleFiles && <th className="pb-2 pr-3 font-medium hidden sm:table-cell">Arquivo</th>}
                    <th className="pb-2 pr-3 font-medium">Tipo</th>
                    <th className="pb-2 pr-3 font-medium text-right">Valor</th>
                    <th className="pb-2 font-medium">
                      <span className="flex items-center gap-1.5">
                        Categoria
                        {aiEnabled && (
                          <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 text-xs px-1.5 py-0">
                            IA ✨
                          </Badge>
                        )}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mergedTransactions.map((tx, i) => (
                    <tr key={`${tx._filename ?? ''}-${tx.externalId}-${i}`} className="border-b last:border-0">
                      <td className="py-2 pr-3 whitespace-nowrap">{formatDate(tx.date)}</td>
                      <td className="py-2 pr-3 max-w-[160px] truncate" title={tx.description}>{tx.description}</td>
                      {multipleFiles && (
                        <td className="py-2 pr-3 max-w-[100px] truncate hidden sm:table-cell" title={tx._filename}>
                          <span className="text-xs text-muted-foreground">{truncateName(tx._filename, 18)}</span>
                        </td>
                      )}
                      <td className="py-2 pr-3"><TypeBadge type={tx.type} /></td>
                      <td className={`py-2 pr-3 text-right font-medium ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="py-2">
                        <Select
                          value={categorySelections[tx.externalId] ?? '__none__'}
                          onValueChange={value =>
                            setCategorySelections(prev => ({
                              ...prev,
                              [tx.externalId]: value === '__none__' ? null : value,
                            }))
                          }
                        >
                          <SelectTrigger className="h-7 w-40 text-xs">
                            <SelectValue placeholder="Sem categoria" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Sem categoria</SelectItem>
                            {categories.map(cat => (
                              <SelectItem key={cat.id} value={cat.id} className="text-xs">
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
            {mergedTransactions.length} transações serão importadas
            {multipleFiles && ` (${filePreviews.map(p => `${p.file.name}: ${p.result.total}`).join(', ')})`}
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={handleAICategorize}
              disabled={aiCategorize.isPending || mergedTransactions.length === 0}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {aiCategorize.isPending ? 'Categorizando...' : 'Categorizar com IA'}
            </Button>
            {aiEnabled && hasAnySuggestions && (
              <Button variant="outline" onClick={handleAcceptAllSuggestions}>
                Aceitar sugestões da IA
              </Button>
            )}
            <Button
              onClick={handleConfirm}
              disabled={confirmImport.isPending || mergedTransactions.length === 0}
            >
              {confirmImport.isPending ? 'Importando...' : 'Confirmar Importação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
