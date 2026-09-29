import { ArrowDownLeft, Clock3, ShoppingBag, Wallet } from "lucide-react";
import { MetricCard } from "@/src/components/ui/MetricCard";

const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function OverviewMetrics({ sales, balance, receivable, overdue }: { sales: number; balance: number; receivable: number; overdue: number }) {
  const metrics = [
    { label: "Vendas no período", value: sales, icon: ShoppingBag, tone: "neutral" as const, context: "Total bruto · exemplos locais", trend: { pct: 12.8, subiu: true, positivo: true } },
    { label: "Saldo atual de caixa", value: balance, icon: Wallet, tone: "positive" as const, context: "Abertura + movimentos demonstrativos" },
    { label: "Total a receber", value: receivable, icon: ArrowDownLeft, tone: "neutral" as const, context: "Saldo em aberto de clientes" },
    { label: "Total vencido", value: overdue, icon: Clock3, tone: "negative" as const, context: overdue > 0 ? "Cobrança que precisa de atenção" : "Nenhuma conta vencida" },
  ];
  return <section aria-label="Resumo de vendas e caixa" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
    {metrics.map((metric) => <div data-preview-reveal key={metric.label} className="min-w-0"><MetricCard icone={metric.icon} label={metric.label} valor={metric.value} formatarValor={currency} contexto={metric.context} tom={metric.tone} tendencia={metric.trend} hoverStyle="subtle" /></div>)}
  </section>;
}
