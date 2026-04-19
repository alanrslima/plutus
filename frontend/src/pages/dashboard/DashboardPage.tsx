import { useState } from "react";
import { TrendingUp, TrendingDown, Wallet, ArrowLeftRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAccounts } from "@/hooks/useAccounts";
import { useTransactions } from "@/hooks/useTransactions";
import { useMonthlySummary, useCategorySummary } from "@/hooks/useReports";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Transaction, TransactionType } from "@/types";

const COLORS = [
  "#6366f1",
  "#10b981",
  "#ef4444",
  "#f59e0b",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

const typeLabel: Record<TransactionType, string> = {
  income: "Receita",
  expense: "Despesa",
  transfer: "Transferência",
};
const typeVariant: Record<TransactionType, "income" | "expense" | "transfer"> =
  {
    income: "income",
    expense: "expense",
    transfer: "transfer",
  };

function AmountCell({ t }: { t: Transaction }) {
  const cls =
    t.type === "income"
      ? "text-income"
      : t.type === "expense"
        ? "text-expense"
        : "text-transfer";
  return (
    <span className={`text-sm font-semibold ${cls}`}>
      {t.type === "expense" ? "-" : "+"}
      {formatCurrency(t.amount)}
    </span>
  );
}

export default function DashboardPage() {
  const [viewMode, setViewMode] = useState<"overview" | "month">("overview");
  const [selectedDate, setSelectedDate] = useState(new Date());

  const activeYear =
    viewMode === "month" ? selectedDate.getFullYear() : new Date().getFullYear();
  const monthStart = format(startOfMonth(selectedDate), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(selectedDate), "yyyy-MM-dd");
  const selectedMonthKey = format(selectedDate, "yyyy-MM");

  const { data: accounts = [] } = useAccounts();
  const { data: transactions = [] } = useTransactions(
    viewMode === "month" ? { startDate: monthStart, endDate: monthEnd } : undefined
  );
  const { data: monthlySummary = [] } = useMonthlySummary(activeYear);
  const { data: categorySummary = [] } = useCategorySummary(
    viewMode === "month" ? monthStart : undefined,
    viewMode === "month" ? monthEnd : undefined
  );

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const activeSummaryKey =
    viewMode === "month" ? selectedMonthKey : format(new Date(), "yyyy-MM");
  const currentSummary = monthlySummary.find((s) => s.month === activeSummaryKey);
  const recentTransactions = transactions.slice(0, 5);

  const chartData = monthlySummary.map((s) => {
    const [y, m] = s.month.split("-").map(Number);
    return {
      month: format(new Date(y, m - 1, 1), "MMM", { locale: ptBR }),
      Receitas: s.totalIncome,
      Despesas: s.totalExpense,
    };
  });

  const pieData = categorySummary.slice(0, 7).map((c, i) => ({
    name: c.categoryName,
    value: c.total,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setViewMode("overview")}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === "overview" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
            >
              Visão Geral
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
            >
              Por Mês
            </button>
          </div>
          {viewMode === "month" && (
            <div className="flex items-center gap-1 rounded-lg border border-border px-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSelectedDate((d) => subMonths(d, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[120px] text-center text-sm font-medium capitalize">
                {format(selectedDate, "MMMM yyyy", { locale: ptBR })}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSelectedDate((d) => addMonths(d, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo Total
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalBalance)}
            </div>
            <p className="text-xs text-muted-foreground">
              {accounts.length} conta(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receitas{viewMode === "month" ? ` de ${format(selectedDate, "MMM", { locale: ptBR })}` : " do Mês"}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-income" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-income">
              {formatCurrency(currentSummary?.totalIncome ?? 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Despesas{viewMode === "month" ? ` de ${format(selectedDate, "MMM", { locale: ptBR })}` : " do Mês"}
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-expense" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-expense">
              {formatCurrency(currentSummary?.totalExpense ?? 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Balanço{viewMode === "month" ? ` de ${format(selectedDate, "MMM", { locale: ptBR })}` : " do Mês"}
            </CardTitle>
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${(currentSummary?.balance ?? 0) >= 0 ? "text-income" : "text-expense"}`}
            >
              {formatCurrency(currentSummary?.balance ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Receitas vs Despesas ({activeYear})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                />
                <YAxis
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "none",
                    borderRadius: 8,
                  }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Bar dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="value"
                    paddingAngle={3}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend
                    formatter={(v) => (
                      <span style={{ color: "#94a3b8", fontSize: 12 }}>
                        {v}
                      </span>
                    )}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",

                      border: "none",
                      borderRadius: 8,
                    }}
                    formatter={(v: number) => formatCurrency(v)}
                    itemStyle={{ color: "#fff" }}
                    labelStyle={{ color: "#aaa" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground text-sm">
                Nenhuma despesa categorizada
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Últimas Transações</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link to="/transactions">Ver mais</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma transação ainda
            </p>
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
                      Data
                    </th>
                    <th className="pb-2 font-medium text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b last:border-0 hover:bg-accent/30 transition-colors"
                    >
                      <td className="py-2.5 pr-4">
                        <Badge variant={typeVariant[t.type]}>
                          {typeLabel[t.type]}
                        </Badge>
                      </td>
                      <td
                        className="py-2.5 pr-4 max-w-[180px] truncate font-medium"
                        title={t.description ?? "—"}
                      >
                        {t.description ?? "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground hidden sm:table-cell">
                        {t.categoryName ?? "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground hidden md:table-cell whitespace-nowrap">
                        {formatDate(t.date)}
                      </td>
                      <td className="py-2.5 text-right">
                        <AmountCell t={t} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
