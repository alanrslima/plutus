import { useState } from "react";
import {
  Plus,
  Filter,
  MoreHorizontal,
  Pencil,
  Trash2,
  GitBranch,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, startOfMonth, endOfMonth } from "date-fns";
import {
  useTransactions,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
} from "@/hooks/useTransactions";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories } from "@/hooks/useCategories";
import { useToast } from "@/hooks/useToast";
import { Transaction, TransactionType } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { CurrencyInput } from "@/components/ui/currency-input";
import { MonthSelector } from "@/components/ui/month-selector";
import { formatCurrency, formatDate } from "@/lib/utils";

const schema = z.object({
  accountId: z.string().uuid("Selecione uma conta"),
  destinationAccountId: z.string().optional(),
  categoryId: z.string().optional(),
  referencedTransactionId: z.string().uuid().optional(),
  type: z.enum(["income", "expense", "transfer"]),
  amount: z.number().positive("Valor deve ser positivo"),
  description: z.string().optional(),
  date: z.string().min(1, "Data obrigatória"),
  totalInstallments: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : Number(v)),
    z.number().int().min(1).max(60).optional(),
  ),
});
type FormData = z.infer<typeof schema>;

const typeLabel: Record<TransactionType, string> = {
  income: "Receita",
  expense: "Despesa",
  transfer: "Transferência",
};
const typeVariant: Record<TransactionType, "income" | "expense" | "transfer"> =
  { income: "income", expense: "expense", transfer: "transfer" };

function getMonthBounds(year: number, month: number) {
  const d = new Date(year, month - 1, 1);
  return {
    startDate: format(startOfMonth(d), "yyyy-MM-dd"),
    endDate: format(endOfMonth(d), "yyyy-MM-dd"),
  };
}

export default function TransactionsPage() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
  const [typeFilter, setTypeFilter] = useState<TransactionType | undefined>();
  const [accountFilter, setAccountFilter] = useState<string | undefined>();
  const [showFilters, setShowFilters] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [referencedParent, setReferencedParent] = useState<Transaction | null>(
    null,
  );

  const { startDate, endDate } = getMonthBounds(
    selectedMonth.year,
    selectedMonth.month,
  );
  const { data: transactions = [], isLoading } = useTransactions({
    type: typeFilter,
    accountId: accountFilter,
    startDate,
    endDate,
  });
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "expense",
      date: format(new Date(), "yyyy-MM-dd"),
      amount: 0,
    },
  });
  const selectedType = watch("type");
  const selectedAccountId = watch("accountId");
  const selectedCategoryId = watch("categoryId");
  const selectedDestinationAccountId = watch("destinationAccountId");
  const amountValue = watch("amount");

  function openCreate(parent?: Transaction) {
    setEditing(null);
    setReferencedParent(parent ?? null);
    reset({
      type: "expense",
      date: format(new Date(), "yyyy-MM-dd"),
      amount: 0,
      accountId: undefined,
      destinationAccountId: undefined,
      categoryId: undefined,
      description: undefined,
      totalInstallments: undefined,
      referencedTransactionId: parent?.id,
    });
    setDialogOpen(true);
  }

  function openEdit(t: Transaction) {
    setEditing(t);
    setReferencedParent(null);
    reset({
      accountId: t.accountId,
      destinationAccountId: t.destinationAccountId,
      categoryId: t.categoryId,
      referencedTransactionId: t.referencedTransactionId,
      type: t.type,
      amount: t.amount,
      description: t.description,
      date: t.date.slice(0, 10),
      totalInstallments: undefined,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: FormData) {
    try {
      const payload = {
        ...data,
        date: new Date(data.date).toISOString(),
        categoryId: data.categoryId || undefined,
        destinationAccountId: data.destinationAccountId || undefined,
        totalInstallments: data.totalInstallments || undefined,
        referencedTransactionId: data.referencedTransactionId || undefined,
      };
      if (editing) {
        await updateTransaction.mutateAsync({ id: editing.id, ...payload });
        toast({ title: "Transação atualizada" });
      } else {
        await createTransaction.mutateAsync(payload);
        toast({ title: "Transação criada" });
      }
      setDialogOpen(false);
    } catch {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível salvar a transação",
      });
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteTransaction.mutateAsync(id);
      toast({ title: "Transação excluída" });
    } catch {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível excluir",
      });
    }
  }

  const filteredCategories = categories.filter(
    (c) => !selectedType || c.type === selectedType,
  );
  const accountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transações</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" /> Filtros
          </Button>
          <Button onClick={() => openCreate()} className="gap-2">
            <Plus className="h-4 w-4" /> Nova Transação
          </Button>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex items-center justify-between">
        <MonthSelector value={selectedMonth} onChange={setSelectedMonth} />
      </div>

      {showFilters && (
        <Card>
          <CardContent className="pt-4 flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[150px] space-y-1">
              <Label>Tipo</Label>
              <Select
                value={typeFilter ?? "__none__"}
                onValueChange={(v) =>
                  setTypeFilter(
                    v === "__none__" ? undefined : (v as TransactionType),
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Todos</SelectItem>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                  <SelectItem value="transfer">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[150px] space-y-1">
              <Label>Conta</Label>
              <Select
                value={accountFilter ?? "__none__"}
                onValueChange={(v) =>
                  setAccountFilter(v === "__none__" ? undefined : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Todas</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTypeFilter(undefined);
                  setAccountFilter(undefined);
                }}
              >
                Limpar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Extrato ({transactions.length} transações)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse bg-muted rounded-md"
                />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma transação encontrada.</p>
              <Button variant="link" onClick={() => openCreate()}>
                Criar primeira transação
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Tipo</th>
                    <th className="pb-2 pr-4 font-medium">Descrição</th>
                    <th className="pb-2 pr-4 font-medium hidden sm:table-cell">
                      Categoria
                    </th>
                    <th className="pb-2 pr-4 font-medium hidden md:table-cell">
                      Conta
                    </th>
                    <th className="pb-2 pr-4 font-medium hidden lg:table-cell">
                      Data
                    </th>
                    <th className="pb-2 pr-4 font-medium text-right">Valor</th>
                    <th className="pb-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr
                      key={t.id}
                      className={`border-b last:border-0 hover:bg-accent/30 transition-colors ${t.referencedTransactionId ? 'border-l-2 border-l-primary/30' : ''}`}
                    >
                      <td className="py-2.5 pr-4">
                        <Badge variant={typeVariant[t.type]}>
                          {typeLabel[t.type]}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-4 max-w-[180px]">
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1.5 font-medium truncate" title={t.description ?? '—'}>
                            <span className="truncate">{t.description ?? '—'}</span>
                            {t.totalInstallments && (
                              <span className="text-xs text-muted-foreground font-normal shrink-0">
                                {t.installment}/{t.totalInstallments}x
                              </span>
                            )}
                          </span>
                          {t.hasChildren && (
                            <span className="flex items-center gap-1 text-xs text-primary/70">
                              <GitBranch className="h-2.5 w-2.5 shrink-0" />
                              <span>Tem transações filhas</span>
                            </span>
                          )}
                          {t.referencedTransactionId && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                              <span className="shrink-0">↳</span>
                              <span className="truncate" title={t.referencedTransaction?.description ?? 'Transação pai'}>
                                {t.referencedTransaction?.description ?? 'Transação pai'}
                              </span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 hidden sm:table-cell">
                        {t.categoryName ? (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full border font-medium"
                            style={{
                              borderColor: t.categoryColor ?? undefined,
                              color: t.categoryColor ?? undefined,
                              backgroundColor: t.categoryColor
                                ? `${t.categoryColor}18`
                                : undefined,
                            }}
                          >
                            {t.categoryName}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground hidden md:table-cell whitespace-nowrap">
                        {accountName(t.accountId)}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                        {formatDate(t.date)}
                      </td>
                      <td className="py-2.5 pr-4 text-right whitespace-nowrap">
                        <span
                          className={`font-semibold ${t.type === "income" ? "text-income" : t.type === "expense" ? "text-expense" : "text-transfer"}`}
                        >
                          {t.type === "expense" ? "-" : "+"}
                          {formatCurrency(t.amount)}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <div className="flex justify-end">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-70 p-1">
                              <button
                                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                                onClick={() => openEdit(t)}
                              >
                                <Pencil className="h-3.5 w-3.5" /> Editar
                              </button>
                              <button
                                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                                onClick={() => openCreate(t)}
                              >
                                <GitBranch className="h-3.5 w-3.5" /> Criar
                                transação filha
                              </button>
                              <button
                                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                                onClick={() => handleDelete(t.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Excluir
                              </button>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? "Editar Transação"
                : referencedParent
                  ? "Nova Transação Filha"
                  : "Nova Transação"}
            </DialogTitle>
            {referencedParent && (
              <p className="text-sm text-muted-foreground mt-1">
                Referenciando:{" "}
                <span className="font-medium">
                  {referencedParent.description ?? referencedParent.id}
                </span>
              </p>
            )}
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={selectedType}
                  onValueChange={(v) => setValue("type", v as TransactionType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Receita</SelectItem>
                    <SelectItem value="expense">Despesa</SelectItem>
                    <SelectItem value="transfer">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Conta</Label>
                <Select
                  value={selectedAccountId ?? ""}
                  onValueChange={(v) => setValue("accountId", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.accountId && (
                  <p className="text-sm text-destructive">
                    {errors.accountId.message}
                  </p>
                )}
              </div>

              {selectedType === "transfer" && (
                <div className="space-y-2">
                  <Label>Conta Destino</Label>
                  <Select
                    value={selectedDestinationAccountId ?? ""}
                    onValueChange={(v) => setValue("destinationAccountId", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedType !== "transfer" && (
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={selectedCategoryId ?? ""}
                    onValueChange={(v) => setValue("categoryId", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="flex items-center gap-2">
                            {c.color && (
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: c.color }}
                              />
                            )}
                            {c.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor</Label>
                  <CurrencyInput
                    value={amountValue ?? 0}
                    onChange={(v) => setValue("amount", v)}
                  />
                  {errors.amount && (
                    <p className="text-sm text-destructive">
                      {errors.amount.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input type="date" {...register("date")} />
                  {errors.date && (
                    <p className="text-sm text-destructive">
                      {errors.date.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input placeholder="Opcional..." {...register("description")} />
              </div>

              {!editing && selectedType === "expense" && (
                <div className="space-y-2">
                  <Label>Parcelas</Label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    placeholder="1 (à vista)"
                    {...register("totalInstallments")}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
