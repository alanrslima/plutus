import { useState } from "react";
import { TrendingUp, TrendingDown, Wallet, ArrowLeftRight, ChevronLeft, ChevronRight, PieChart as PieChartIcon, BarChart2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAccounts } from "@/hooks/useAccounts";
import { useMonthlySummary, useCategorySummary, useDailySummary, useCumulativeSummary, useBalanceAsOfDate } from "@/hooks/useReports";
import { formatCurrency } from "@/lib/utils";
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
  LineChart,
  Line,
} from "recharts";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, getDaysInMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

const COLORS = [
  "#6366f1",
  "#10b981",
  "#ef4444",
  "#f59e0b",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#a855f7",
  "#06b6d4",
  "#84cc16",
  "#e11d48",
  "#0ea5e9",
  "#d97706",
  "#7c3aed",
  "#059669",
  "#dc2626",
  "#2563eb",
  "#db2777",
];

export default function DashboardPage() {
  const [categoryChartType, setCategoryChartType] = useState<"pie" | "bar">("pie");
  const [selectedDate, setSelectedDate] = useState(new Date());

  const activeYear = selectedDate.getFullYear();
  const activeMonth = selectedDate.getMonth() + 1;
  const monthStart = format(startOfMonth(selectedDate), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(selectedDate), "yyyy-MM-dd");
  const selectedMonthKey = format(selectedDate, "yyyy-MM");

  const { data: accounts = [] } = useAccounts();
  const { data: monthlySummary = [] } = useMonthlySummary(activeYear);
  const { data: categorySummary = [] } = useCategorySummary(monthStart, monthEnd);
  const { data: dailySummary = [] } = useDailySummary(activeYear, activeMonth);
  const { data: cumulativeSummary } = useCumulativeSummary(monthEnd);
  const { data: balanceAsOfDate } = useBalanceAsOfDate(monthEnd);

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const currentSummary = monthlySummary.find((s) => s.month === selectedMonthKey);

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

  const barCategoryData = categorySummary.map((c, i) => ({
    name: c.categoryName,
    Despesas: c.total,
    color: COLORS[i % COLORS.length],
  }));

  const daysInMonth = getDaysInMonth(selectedDate);
  const dailyChartData = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const dayStr = format(new Date(activeYear, activeMonth - 1, day), "yyyy-MM-dd");
    const found = dailySummary.find((d) => d.day === dayStr);
    return {
      day: String(day),
      Receitas: found?.totalIncome ?? 0,
      Despesas: found?.totalExpense ?? 0,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
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
            <p className="text-xs text-muted-foreground">
              Saldo em {format(selectedDate, "MMM/yy", { locale: ptBR })}: {formatCurrency(balanceAsOfDate?.balance ?? 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receitas de {format(selectedDate, "MMM", { locale: ptBR })}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-income" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-income">
              {formatCurrency(currentSummary?.totalIncome ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Acumulado até {format(selectedDate, "MMM/yy", { locale: ptBR })}: {formatCurrency(cumulativeSummary?.totalIncome ?? 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Despesas de {format(selectedDate, "MMM", { locale: ptBR })}
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-expense" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-expense">
              {formatCurrency(currentSummary?.totalExpense ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Acumulado até {format(selectedDate, "MMM/yy", { locale: ptBR })}: {formatCurrency(cumulativeSummary?.totalExpense ?? 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Balanço de {format(selectedDate, "MMM", { locale: ptBR })}
            </CardTitle>
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${(currentSummary?.balance ?? 0) >= 0 ? "text-income" : "text-expense"}`}
            >
              {formatCurrency(currentSummary?.balance ?? 0)}
            </div>
            <p
              className={`text-xs ${(cumulativeSummary?.balance ?? 0) >= 0 ? "text-income" : "text-expense"}`}
            >
              Acumulado até {format(selectedDate, "MMM/yy", { locale: ptBR })}: {formatCurrency(cumulativeSummary?.balance ?? 0)}
            </p>
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
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Despesas por Categoria</CardTitle>
            <div className="flex rounded-md border border-border overflow-hidden">
              <button
                onClick={() => setCategoryChartType("pie")}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors ${categoryChartType === "pie" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
                title="Gráfico de pizza"
              >
                <PieChartIcon className="h-3.5 w-3.5" />
                Pizza
              </button>
              <button
                onClick={() => setCategoryChartType("bar")}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors ${categoryChartType === "bar" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
                title="Gráfico de barras"
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Barras
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {categorySummary.length > 0 ? (
              categoryChartType === "pie" ? (
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
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={barCategoryData} margin={{ bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
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
                      itemStyle={{ color: "#fff" }}
                      labelStyle={{ color: "#aaa" }}
                    />
                    <Bar dataKey="Despesas" radius={[4, 4, 0, 0]}>
                      {barCategoryData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground text-sm">
                Nenhuma despesa categorizada
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily cash flow */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Fluxo de Caixa Diário — {format(selectedDate, "MMMM yyyy", { locale: ptBR })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={dailyChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="day"
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                interval={4}
              />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                width={56}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "none",
                  borderRadius: 8,
                }}
                formatter={(v: number) => formatCurrency(v)}
                itemStyle={{ color: "#fff" }}
                labelStyle={{ color: "#94a3b8" }}
                labelFormatter={(label) => `Dia ${label}`}
              />
              <Legend
                formatter={(v) => (
                  <span style={{ color: "#94a3b8", fontSize: 12 }}>{v}</span>
                )}
              />
              <Line
                type="monotone"
                dataKey="Receitas"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="Despesas"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
