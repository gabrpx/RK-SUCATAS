import { ArrowDownLeft, BanknoteArrowDown, ShoppingBag, Wallet } from "lucide-react";
import { MetricCard } from "@/src/components/ui/MetricCard";

const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function OverviewMetrics({ sales, salesCount, cashIn, cashInCount, balance, receivable, cashAvailable = true, periodLabel }: { sales: number; salesCount: number; cashIn: number | null; cashInCount: number | null; balance: number | null; receivable: number | null; cashAvailable?: boolean; periodLabel: string }) {
  const metrics = [
    { label: "Vendas registradas", value: sales, icon: ShoppingBag, tone: "neutral" as const, context: `${salesCount} ${salesCount === 1 ? "venda" : "vendas"} · bruto em ${periodLabel}` },
    { label: "Entrou no Caixa", value: cashIn ?? "—", icon: BanknoteArrowDown, tone: "positive" as const, context: cashAvailable ? `${cashInCount ?? 0} ${(cashInCount ?? 0) === 1 ? "entrada" : "entradas"} efetivas em ${periodLabel}` : "Dados indisponíveis para este perfil" },
    { label: "Saldo após saídas", value: balance ?? "—", icon: Wallet, tone: "positive" as const, context: cashAvailable ? `Entradas menos saídas em ${periodLabel}` : "Dados indisponíveis para este perfil" },
    { label: "Total a receber", value: receivable ?? "—", icon: ArrowDownLeft, tone: "neutral" as const, context: cashAvailable ? "Fiado e pendências abertas" : "Dados indisponíveis para este perfil" },
  ];
  return <section aria-label="Resumo de vendas e caixa" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
    {metrics.map((metric) => <div data-preview-reveal key={metric.label} className="min-w-0"><MetricCard icone={metric.icon} label={metric.label} valor={metric.value} formatarValor={currency} contexto={metric.context} tom={metric.tone} hoverStyle="subtle" /></div>)}
  </section>;
}
