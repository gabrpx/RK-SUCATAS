import { AlertTriangle, ArrowDownLeft, BanknoteArrowDown, ShoppingBag, Wallet } from "lucide-react";
import { MetricCard } from "@/src/components/ui/MetricCard";

const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function OverviewMetrics({ sales, salesCount, cashIn, cashInCount, balance, receivable, overdue, cashAvailable = true, periodLabel }: { sales: number; salesCount: number; cashIn: number | null; cashInCount: number | null; balance: number | null; receivable: number | null; overdue: number | null; cashAvailable?: boolean; periodLabel: string }) {
  const periodMetrics = [
    { label: "Vendas registradas", value: sales, icon: ShoppingBag, tone: "neutral" as const, context: `${salesCount} ${salesCount === 1 ? "venda" : "vendas"} · bruto em ${periodLabel}` },
    { label: "Entrou no Caixa", value: cashIn ?? "—", icon: BanknoteArrowDown, tone: "positive" as const, context: cashAvailable ? `${cashInCount ?? 0} ${(cashInCount ?? 0) === 1 ? "entrada" : "entradas"} efetivas em ${periodLabel}` : "Dados indisponíveis para este perfil" },
    { label: "Resultado líquido", value: balance ?? "—", icon: Wallet, tone: "positive" as const, context: cashAvailable ? `Entradas menos saídas em ${periodLabel}` : "Dados indisponíveis para este perfil" },
  ];
  const currentMetrics = [
    { label: "Total a receber", value: receivable ?? "—", icon: ArrowDownLeft, tone: "neutral" as const, context: cashAvailable ? "Fiado e pendências abertas" : "Dados indisponíveis para este perfil" },
    { label: "Total em atraso", value: overdue ?? "—", icon: AlertTriangle, tone: "negative" as const, context: cashAvailable ? "Recebíveis vencidos na posição atual" : "Dados indisponíveis para este perfil" },
  ];
  return <section aria-label="Resumo de vendas e caixa" className="space-y-5">
    <div><p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">No período</p><div className="relative flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden pr-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-8 after:bg-gradient-to-l after:from-surface-page after:to-transparent sm:grid sm:grid-cols-2 sm:overflow-visible sm:pr-0 sm:after:hidden xl:grid-cols-3">{periodMetrics.map((metric) => <div data-preview-reveal key={metric.label} className="min-w-[84%] snap-start sm:min-w-0"><MetricCard icone={metric.icon} label={metric.label} valor={metric.value} formatarValor={currency} contexto={metric.context} tom={metric.tone} hoverStyle="subtle" valorPeso="bold" /></div>)}</div></div>
    <div><p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">Posição atual</p><div className="relative flex snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden pr-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-8 after:bg-gradient-to-l after:from-surface-page after:to-transparent sm:grid sm:grid-cols-2 sm:overflow-visible sm:pr-0 sm:after:hidden">{currentMetrics.map((metric) => <div data-preview-reveal key={metric.label} className="min-w-[84%] snap-start sm:min-w-0"><MetricCard icone={metric.icon} label={metric.label} valor={metric.value} formatarValor={currency} contexto={metric.context} tom={metric.tone} hoverStyle="subtle" valorPeso="bold" /></div>)}</div></div>
  </section>;
}
