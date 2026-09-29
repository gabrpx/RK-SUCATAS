import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis as RechartsXAxis, YAxis, Tooltip, Bar, Line } from "recharts";
import { Area, AreaChart } from "@/src/components/charts/area-chart";
import { Grid } from "@/src/components/charts/grid";
import { XAxis } from "@/src/components/charts/x-axis";
import { ChartTooltip } from "@/src/components/charts/tooltip";
import type { MovimentoDemo, VendaDemo } from "../data";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function weekDates() {
  const today = new Date(2026, 8, 29);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return date;
  });
}

export function SalesTrendChart({ period, sales }: { period: string; sales: VendaDemo[] }) {
  const lastWeek = [1000, 1100, 980, 1075, 900, 1080, 1334];
  const totals = new Map<string, number>();
  sales.forEach((sale) => {
    const key = dateKey(new Date(sale.ocorridoEm));
    totals.set(key, (totals.get(key) ?? 0) + sale.valor);
  });
  const today = dateKey(new Date(2026, 8, 29));
  const data = weekDates().map((date, index) => ({
    date,
    vendas: period === "Hoje" && dateKey(date) !== today ? 0 : totals.get(dateKey(date)) ?? 0,
    anterior: lastWeek[index],
  }));
  return <div className="mt-4 rounded-control border border-border-subtle bg-surface-inset p-3 sm:p-4" style={{ height: 232 }}>
    <AreaChart data={data} aspectRatio="auto" style={{ height: "100%" }} margin={{ top: 14, right: 12, bottom: 24, left: 12 }} animationDuration={650}>
      <Grid horizontal stroke="rgba(148,163,184,.22)" numTicksRows={4} hideHorizontalEdgeLines />
      <Area dataKey="anterior" fill="#94a3b8" fillOpacity={0.04} stroke="#94a3b8" strokeWidth={1.5} showMarkers={false} fadeEdges />
      <Area dataKey="vendas" fill="#2563eb" fillOpacity={0.13} stroke="#2563eb" strokeWidth={2.5} showMarkers fadeEdges />
      <ChartTooltip rows={(ponto) => [
        { color: "#2563eb", label: "Vendas", value: money(Number(ponto.vendas ?? 0)) },
        { color: "#94a3b8", label: "Período anterior", value: money(Number(ponto.anterior ?? 0)) },
      ]} backgroundColor="#ffffff" panelStyle={{ border: "1px solid #e2e8f0", boxShadow: "0 12px 30px rgba(15,23,42,.12)" }} />
      <XAxis numTicks={7} />
    </AreaChart>
    <div className="mt-1 flex flex-wrap gap-4 px-1 text-[11px] text-text-muted"><span className="inline-flex items-center gap-2"><i className="size-2 rounded-full bg-accent" />Este período</span><span className="inline-flex items-center gap-2"><i className="size-2 rounded-full bg-slate-400" />Período anterior</span></div>
  </div>;
}

export function CashFlowChart({ items }: { items: MovimentoDemo[] }) {
  const sums = new Map<string, { entradas: number; saidas: number }>();
  items.forEach((item) => {
    const key = dateKey(new Date(item.ocorridoEm));
    const values = sums.get(key) ?? { entradas: 0, saidas: 0 };
    if (item.tipo === "entrada") values.entradas += item.valor;
    else values.saidas += item.valor;
    sums.set(key, values);
  });
  const data = weekDates().map((date) => {
    const values = sums.get(dateKey(date)) ?? { entradas: 0, saidas: 0 };
    return { dia: date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""), ...values, saldo: values.entradas - values.saidas };
  });
  return <div className="mt-4 h-[232px] rounded-control border border-border-subtle bg-surface-inset p-3 sm:p-4">
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -22 }}>
        <CartesianGrid vertical={false} stroke="rgba(148,163,184,.2)" strokeDasharray="3 5" />
        <RechartsXAxis dataKey="dia" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10 }} dy={8} />
        <YAxis hide />
        <Tooltip formatter={(value) => money(Number(value ?? 0))} contentStyle={{ borderRadius: 6, borderColor: "#e2e8f0", boxShadow: "0 12px 30px rgba(15,23,42,.12)", fontSize: 12 }} />
        <Bar dataKey="entradas" name="Entradas" fill="#2563eb" radius={[3, 3, 0, 0]} maxBarSize={18} />
        <Bar dataKey="saidas" name="Saídas" fill="#cbd5e1" radius={[3, 3, 0, 0]} maxBarSize={18} />
        <Line dataKey="saldo" name="Saldo líquido" stroke="#047857" strokeWidth={2} dot={{ r: 2.5, fill: "#047857", strokeWidth: 0 }} activeDot={{ r: 4 }} />
      </ComposedChart>
    </ResponsiveContainer>
  </div>;
}
