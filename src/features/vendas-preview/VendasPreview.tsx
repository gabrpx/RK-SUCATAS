import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { animate, stagger } from "animejs";
import { DotMatrix } from "dot-anime-react";
import {
  Activity, ArrowDownLeft, ArrowUpRight, BellRing, Bike, CalendarDays, Check,
  ChevronDown, ChevronRight, Clock3, FileImage, Plus,
  Search, ShoppingBag, SlidersHorizontal, Wallet, X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { lightInventoryTokens } from "../estoque-preview/InventoryDrawer";
import { Button } from "@/src/components/ui/button";
import { Select } from "@/src/components/ui/Select";
import { PopoverContent, PopoverHeader, PopoverRoot, PopoverTrigger } from "@/src/components/ui/popover";
import { SPRING_MICRO } from "@/src/components/ui/motion";
import { fetchWithRetry, parseJson } from "@/src/lib/apiClient";
import { podeAtual } from "@/src/hooks/usePermissao";
import type { Cliente, ClienteMotoResumo } from "@/src/features/clientes/types";
import {
  type AbaVendasPreview, type CanalVendaDemo, type MeioPagamentoDemo, type MovimentoDemo,
  type PendenciaDemo, type PeriodoVendasPreview, type VendaDemo,
  movimentosDemoIniciais, pendenciasDemoIniciais,
  vendasDemoIniciais,
} from "./data";
import { CashFlowChart, SalesTrendChart } from "./components/SalesCharts";
import { OverviewMetrics } from "./components/OverviewMetrics";
import { ActionDrawer, type AcaoConfirmada, type AcaoPreview } from "./components/ActionDrawer";
import { SaleDetailDrawer } from "./components/SaleDetailDrawer";
import { MercadoLivreBadge, PaymentMethodMark } from "./components/PaymentMarks";
import { Tabs as SegmentTabs, TabsList as SegmentTabsList, TabsTrigger as SegmentTabsTrigger } from "../tarefas-preview/PreviewTabs";
import { filtrarMovimentosPorPeriodo, type PeriodoMovimento } from "./movementFilters";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const previewTokens = {
  ...lightInventoryTokens,
  "--chart-background": "#ffffff",
  "--chart-foreground": "#0f172a",
  "--chart-foreground-muted": "#64748b",
  "--chart-label": "#64748b",
  "--chart-line-primary": "#2563eb",
  "--chart-line-secondary": "#94a3b8",
  "--chart-grid": "rgba(148,163,184,.22)",
  "--chart-crosshair": "#94a3b8",
  "--chart-indicator-color": "#2563eb",
  "--chart-indicator-secondary-color": "#94a3b8",
  "--chart-tooltip-background": "#ffffff",
  "--chart-tooltip-foreground": "#0f172a",
  "--chart-tooltip-muted": "#64748b",
  "--chart-1": "#2563eb",
  "--chart-2": "#047857",
  "--chart-3": "#94a3b8",
  "--gradient-accent-cta": "linear-gradient(135deg, #3b82f6, #1d4ed8)",
  "--elevation-glow-accent": "0 0 24px -8px rgba(37,99,235,.32)",
} as CSSProperties;

const abas: AbaVendasPreview[] = ["Visão geral", "Vendas", "Movimentações", "Pendências"];
const label = "font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint";
const panel = "rounded-card border border-border-default bg-surface-card shadow-sm";
const control = "inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-border-default bg-surface-card px-3 text-sm font-semibold text-text-secondary transition hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30";
const inputClass = "h-11 w-full rounded-control border border-border-default bg-surface-inset px-3 text-base text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm";
const openingBalance = 0;
const dataReferenciaDemo = new Date(2026, 8, 29, 12);
const umDia = 86400000;
type StatusClientesPreview = "carregando" | "pronto" | "restrito" | "erro";

function dateLabel(iso: string) {
  const date = new Date(iso);
  const now = new Date(2026, 8, 29);
  const days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86400000);
  const hora = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${days === 0 ? "Hoje" : days === 1 ? "Ontem" : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}, ${hora}`;
}

function dataLimitePendencia(item: PendenciaDemo) {
  return item.venceEm ? new Date(item.venceEm) : new Date(new Date(item.criadaEm).getTime() + 30 * 86400000);
}

function diasAteVencimento(item: PendenciaDemo) {
  if (!item.venceEm && item.tipo === "A pagar") return null;
  const limite = dataLimitePendencia(item);
  const hoje = new Date(dataReferenciaDemo.getFullYear(), dataReferenciaDemo.getMonth(), dataReferenciaDemo.getDate()).getTime();
  const vencimento = new Date(limite.getFullYear(), limite.getMonth(), limite.getDate()).getTime();
  return Math.round((vencimento - hoje) / umDia);
}

function pendenciaVencida(item: PendenciaDemo) {
  const dias = diasAteVencimento(item);
  return item.pago < item.total && dias !== null && dias < 0;
}

function vencimentoLabel(item: PendenciaDemo) {
  if (!item.venceEm && item.tipo === "A receber") {
    const diasEmAberto = Math.max(0, Math.floor((dataReferenciaDemo.getTime() - new Date(item.criadaEm).getTime()) / umDia));
    const falta = diasAteVencimento(item) ?? 0;
    return falta < 0 ? `Vencida há ${Math.abs(falta)} dias · prazo padrão` : `Em aberto há ${diasEmAberto} dias · vence em ${falta} dias`;
  }
  if (!item.venceEm) return "Sem vencimento informado";
  const dias = diasAteVencimento(item) ?? 0;
  return dias < 0 ? `Vencida há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? "dia" : "dias"}` : dias === 0 ? "Vence hoje" : `Vence em ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

function pendenciaUrgente(item: PendenciaDemo) {
  if (item.pago >= item.total) return false;
  const dias = diasAteVencimento(item);
  return item.tipo === "A receber" ? dias !== null && dias < 0 : dias !== null && dias <= 7;
}

function SectionTitle({ eyebrow, title, aside }: { eyebrow: string; title: string; aside?: ReactNode }) {
  return <div className="flex flex-wrap items-end justify-between gap-3"><div><p className={label}>{eyebrow}</p><h2 className="mt-1 text-lg font-semibold tracking-tight text-text-primary">{title}</h2></div>{aside}</div>;
}

function MultiFilter({ label: title, selected, options, onChange }: { label: string; selected: string[]; options: string[]; onChange: (values: string[]) => void }) {
  const toggle = (value: string) => onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  return <PopoverRoot variant="subtle">
    <PopoverTrigger className={`${control} h-11 md:h-11 normal-case tracking-normal bg-surface-card`}>
      {title}{selected.length > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-accent-soft-bg px-1.5 py-0.5 font-mono text-[10px] text-accent">{selected.length}</span>}<ChevronDown size={14} className="text-text-faint" />
    </PopoverTrigger>
    <PopoverContent className="w-64 max-w-[calc(100vw-2rem)] p-2">
      <PopoverHeader className="px-2 pt-1">Filtrar por {title.toLowerCase()}</PopoverHeader>
      <div role="group" aria-label={`Filtrar por ${title.toLowerCase()}`} className="max-h-64 overflow-y-auto">
      {options.map((option) => {
        const active = selected.includes(option);
        return <button key={option} type="button" aria-pressed={active} onClick={() => toggle(option)} className={`flex min-h-10 w-full items-center gap-2 rounded-control px-2.5 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 ${active ? "bg-accent-soft-bg text-accent" : "text-text-secondary hover:bg-surface-inset"}`}><span className={`grid size-4 shrink-0 place-items-center rounded border ${active ? "border-accent bg-accent text-white" : "border-border-default bg-surface-card"}`}>{active && <Check size={11} />}</span>{option}</button>;
      })}
      </div>
    </PopoverContent>
  </PopoverRoot>;
}

function FilterChip({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return <button type="button" onClick={onRemove} className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-accent/20 bg-accent-soft-bg px-2.5 text-[11px] font-medium text-accent hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">{children}<X size={12} aria-hidden="true" /></button>;
}

function meiosDoRotulo(metodo: string): MeioPagamentoDemo[] {
  const texto = metodo.toLocaleLowerCase("pt-BR");
  return [
    ...(texto.includes("pix") ? ["Pix" as const] : []),
    ...(texto.includes("dinheiro") ? ["Dinheiro" as const] : []),
    ...(texto.includes("débito") || texto.includes("debito") ? ["Cartão de débito" as const] : []),
    ...(texto.includes("crédito") || texto.includes("credito") ? ["Cartão de crédito" as const] : []),
  ];
}

function Overview({
  period, sales, receivable, overdue, balance, pendencies, salesRows, movementRows, onOpenTab,
}: {
  period: string; sales: number; receivable: number; overdue: number; balance: number;
  pendencies: PendenciaDemo[]; salesRows: VendaDemo[]; movementRows: MovimentoDemo[]; onOpenTab: (tab: AbaVendasPreview) => void;
}) {
  const attention = pendencies.filter(pendenciaUrgente).sort((a, b) => (diasAteVencimento(a) ?? 99) - (diasAteVencimento(b) ?? 99));
  const pendenciasAbertas = pendencies.filter((item) => item.pago < item.total);
  const diasAtraso = (item: PendenciaDemo) => Math.max(0, Math.abs(diasAteVencimento(item) ?? 0));
  const aging = [
    { label: "Vence em até 7d", count: pendenciasAbertas.filter((p) => { const dias = diasAteVencimento(p); return dias !== null && dias >= 0 && dias <= 7; }).length, tone: "bg-warning" },
    { label: "Atraso · 1–7d", count: pendenciasAbertas.filter((p) => pendenciaVencida(p) && diasAtraso(p) < 8).length, tone: "bg-danger/70" },
    { label: "Atraso · 8–30d", count: pendenciasAbertas.filter((p) => pendenciaVencida(p) && diasAtraso(p) >= 8 && diasAtraso(p) <= 30).length, tone: "bg-danger/85" },
    { label: "Atraso · 30+d", count: pendenciasAbertas.filter((p) => pendenciaVencida(p) && diasAtraso(p) > 30).length, tone: "bg-danger" },
    { label: "Sem urgência", count: pendenciasAbertas.filter((p) => { const dias = diasAteVencimento(p); return dias === null || dias > 7; }).length, tone: "bg-slate-400" },
  ];
  const ageTotal = Math.max(1, aging.reduce((sum, item) => sum + item.count, 0));

  return <div className="space-y-6">
    <OverviewMetrics sales={sales} balance={balance} receivable={receivable} overdue={overdue} />

    <AnimatePresence initial={false}>
      {attention.length > 0 && <motion.section key="attention" aria-label="Pendências urgentes" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={SPRING_MICRO} className="overflow-hidden rounded-card border border-border-default bg-surface-card shadow-sm">
        <div className="flex flex-col gap-4 border-l-[3px] border-l-danger p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div className="flex min-w-0 items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-control bg-danger-bg text-danger"><BellRing size={17} /></span><div className="min-w-0"><p className="text-sm font-semibold text-text-primary">{attention.length} {attention.length === 1 ? "item precisa" : "itens precisam"} de revisão</p><div className="mt-2 flex flex-wrap gap-2">{attention.slice(0, 2).map((item) => <span key={item.id} className="inline-flex max-w-full flex-wrap items-center gap-x-1.5 rounded-full border border-border-default bg-surface-inset px-2.5 py-1 text-xs text-text-secondary"><strong className="font-semibold text-text-primary">{item.nome}</strong><span>·</span><span>{money(item.total - item.pago)}</span><span>·</span><span className={pendenciaVencida(item) ? "font-semibold text-danger" : "font-semibold text-warning"}>{vencimentoLabel(item)}</span></span>)}</div><p className="mt-2 text-[11px] text-text-muted">Recebimentos atrasados e contas a pagar com prazo próximo.</p></div></div><button type="button" className={`${control} w-full shrink-0 sm:w-auto`} onClick={() => onOpenTab("Pendências")}>Revisar pendências<ChevronRight size={15} /></button></div>
      </motion.section>}
    </AnimatePresence>

    <div className="grid min-w-0 gap-4 xl:grid-cols-[1.25fr_.95fr]">
      <section data-preview-reveal className={`${panel} min-w-0 p-4 sm:p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className={label}>Desempenho comercial</p><h2 className="mt-1 text-base font-semibold">Ritmo de vendas</h2><p className="mt-1 text-xs text-text-muted">Comparação com o período anterior · {period.toLowerCase()}</p></div><div className="text-right"><p className="text-xl font-semibold tracking-tight">{money(sales)}</p><span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-positive"><Activity size={13} />12,8%</span></div></div>
        <SalesTrendChart period={period} sales={salesRows} />
      </section>
      <section data-preview-reveal className={`${panel} min-w-0 p-4 sm:p-5`}>
        <div><p className={label}>Caixa em movimento</p><h2 className="mt-1 text-base font-semibold">Entradas, saídas e saldo líquido</h2><p className="mt-1 text-xs text-text-muted">Movimentos concluídos · visão demonstrativa</p></div>
        <CashFlowChart items={movementRows} />
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-text-muted"><span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-sm bg-accent" />Entradas</span><span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-sm bg-slate-300" />Saídas</span><span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-positive" />Saldo líquido</span></div>
      </section>
    </div>

    <div className="grid min-w-0 gap-4 xl:grid-cols-[.9fr_1.1fr]">
      <section data-preview-reveal className={`${panel} min-w-0 p-4 sm:p-5`}>
        <SectionTitle eyebrow="Idade das pendências" title="O que vem primeiro" aside={<button type="button" onClick={() => onOpenTab("Pendências")} className="inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-accent">Abrir fila<ChevronRight size={14} /></button>} />
        <div className="mt-5 space-y-3.5">{aging.map((bucket) => <div className="flex items-center gap-3" key={bucket.label}><span className="w-24 shrink-0 text-xs text-text-secondary">{bucket.label}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-inset"><motion.div initial={{ width: 0 }} animate={{ width: `${bucket.count ? Math.max(12, (bucket.count / ageTotal) * 100) : 0}%` }} transition={{ duration: .55, ease: "easeOut" }} className={`h-full rounded-full ${bucket.tone}`} /></div><span className="w-5 text-right font-mono text-xs font-semibold tabular-nums">{bucket.count}</span></div>)}</div>
        <p className="mt-5 border-t border-border-subtle pt-3 text-[11px] leading-5 text-text-muted">Sem primeiro pagamento, o prazo conta desde a venda e vence após 30 dias. Depois de um pagamento parcial, vale o novo vencimento definido pela equipe.</p>
      </section>
      <section data-preview-reveal className={`${panel} min-w-0 p-4 sm:p-5`}>
        <SectionTitle eyebrow="Atenção da equipe" title="Próximos vencimentos" aside={<button type="button" onClick={() => onOpenTab("Pendências")} className="inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-accent">Ver todos<ChevronRight size={14} /></button>} />
        <div className="mt-3 divide-y divide-border-subtle">{pendencies.filter((item) => item.pago < item.total).slice(0, 4).map((item) => <div key={item.id} className="flex min-w-0 items-center justify-between gap-3 py-3"><div className="flex min-w-0 items-center gap-2.5"><span className={`grid size-8 shrink-0 place-items-center rounded-md ${item.tipo === "A pagar" ? "bg-surface-inset text-text-secondary" : "bg-accent-soft-bg text-accent"}`}>{item.tipo === "A pagar" ? <ArrowUpRight size={15} /> : <ArrowDownLeft size={15} />}</span><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.nome}</p><p className="mt-0.5 truncate text-xs text-text-muted">{item.tipo} · {vencimentoLabel(item)}</p></div></div><p className="shrink-0 text-sm font-semibold tabular-nums">{money(item.total - item.pago)}</p></div>)}</div>
      </section>
    </div>
  </div>;
}

function SalesList({ sales, onDetail, onClearFilters }: { sales: VendaDemo[]; onDetail: (sale: VendaDemo) => void; onClearFilters: () => void }) {
  if (sales.length === 0) return <div className="rounded-card border border-dashed border-border-default bg-surface-card p-10 text-center"><span className="mx-auto grid size-11 place-items-center rounded-full bg-surface-inset text-text-muted"><Search size={17} /></span><p className="mt-3 text-sm font-semibold">Nenhuma venda corresponde aos filtros</p><p className="mt-1 text-xs text-text-muted">Remova um filtro ou limpe a seleção para ver outras vendas.</p><button type="button" onClick={onClearFilters} className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-control px-3 text-xs font-semibold text-accent hover:bg-accent-soft-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"><X size={14} />Limpar filtros</button></div>;
  return <div className={`${panel} overflow-hidden`}>
    <div className="hidden grid-cols-[1.15fr_1.65fr_1fr_.8fr_.9fr] gap-3 bg-surface-inset px-4 py-3 md:grid"><span className={label}>Cliente · canal</span><span className={label}>Peça · unidade</span><span className={label}>Pagamento recebido</span><span className={`${label} text-right`}>Valor</span><span className={`${label} text-right`}>Estado</span></div>
    <div className="divide-y divide-border-subtle">{sales.map((sale, index) => <motion.button layout key={sale.id} type="button" aria-label={`Abrir detalhes da venda ${sale.id}, cliente ${sale.cliente}`} onClick={() => onDetail(sale)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_MICRO, delay: Math.min(index * .035, .18) }} className={`grid gap-2 p-4 text-left transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 md:grid-cols-[1.15fr_1.65fr_1fr_.8fr_.9fr] md:items-center md:gap-3 ${sale.canal === "Mercado Livre" ? "meli-sale-row mx-2 my-1 w-[calc(100%-1rem)] rounded-control border border-[#e7ca00] bg-amber-50/20" : "w-full"}`}>
      <span className="min-w-0"><span className="block truncate text-sm font-semibold">{sale.cliente}</span><span className="mt-0.5 block font-mono text-[10px] text-text-faint">{sale.id} · {dateLabel(sale.ocorridoEm)}</span><span className="mt-1 block"><MercadoLivreBadge canal={sale.canal} compact /></span></span>
      <span className="min-w-0"><span className="block break-words text-sm text-text-secondary">{sale.item}</span><span className="mt-0.5 block font-mono text-[10px] text-text-faint">Unidade {sale.unidade} · Grau {sale.grau}</span></span>
      <span className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-text-muted">{sale.pagamentos.length ? sale.pagamentos.map((pagamento, pagamentoIndex) => <span key={`${pagamento.meio}-${pagamentoIndex}`} title={`${pagamento.meio}: ${money(pagamento.valor)}`} className="inline-flex items-center gap-1"><PaymentMethodMark meio={pagamento.meio} className="size-3.5" />{pagamento.meio}</span>) : <span>Sem pagamento</span>}{sale.temComprovantePix && <span className="inline-flex items-center gap-1 text-text-faint"><FileImage size={12} />Comprovante</span>}</span>
      <span className="text-sm font-semibold tabular-nums md:text-right">{money(sale.valor)}</span>
      <span className={`w-fit rounded-full px-2 py-1 text-[10px] font-semibold md:ml-auto ${sale.recebido >= sale.valor ? "bg-positive-bg text-positive" : "bg-warning-bg text-warning"}`}>{sale.recebido >= sale.valor ? "Pago" : `Saldo ${money(sale.valor - sale.recebido)}`}</span>
    </motion.button>)}</div>
    <div className="border-t border-border-default px-4 py-3 text-center text-[10px] text-text-faint">Dados fictícios desta demonstração · selecione uma linha para ver detalhes</div>
  </div>;
}

function MovementsList({ items }: { items: MovimentoDemo[] }) {
  const reduceMotion = useReducedMotion();
  return <div className={`${panel} overflow-hidden`}><div className="divide-y divide-border-subtle"><AnimatePresence initial={false} mode="popLayout">{items.map((item) => <motion.div layout key={item.id} initial={reduceMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -4 }} transition={reduceMotion ? { duration: 0 } : { ...SPRING_MICRO, duration: .16 }} className={`flex min-w-0 items-center gap-3 p-4 ${item.tipo === "saída" ? "border-l-[3px] border-l-negative/70 bg-negative-bg/20" : ""}`}>
    <span className={`grid size-10 shrink-0 place-items-center rounded-md ${item.tipo === "entrada" ? "bg-positive-bg text-positive" : "bg-negative-bg text-negative"}`}>{item.tipo === "entrada" ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</span>
    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.titulo}</span><span className="mt-1 block truncate text-xs text-text-muted">{item.detalhe} · {dateLabel(item.ocorridoEm)}</span><span className="mt-1 block font-mono text-[9px] uppercase tracking-wide text-text-faint">{item.origem}</span></span>
    <span className="shrink-0 text-right"><span className={`block text-sm font-semibold tabular-nums ${item.tipo === "entrada" ? "text-positive" : "text-negative"}`}>{item.tipo === "entrada" ? "+" : "−"}{money(item.valor)}</span><span className="mt-1 inline-flex items-center justify-end gap-1 text-[10px] text-text-faint">{meiosDoRotulo(item.metodo).map((meio, meioIndex) => <PaymentMethodMark key={`${meio}-${meioIndex}`} meio={meio} className="size-3" />)}{item.metodo}</span></span>
  </motion.div>)}</AnimatePresence>{!items.length && <p role="status" className="border-t border-dashed border-border-default p-10 text-center text-sm text-text-muted">Nenhuma movimentação corresponde aos filtros.</p>}</div></div>;
}

function PendingList({ items, onAction, hasActiveFilters, onClearFilters }: { items: PendenciaDemo[]; onAction: (action: AcaoPreview) => void; hasActiveFilters: boolean; onClearFilters: () => void }) {
  const [historicoAberto, setHistoricoAberto] = useState<Record<string, boolean>>({});
  const reduceMotion = useReducedMotion();
  if (!items.length) return <div className="rounded-card border border-dashed border-border-default bg-surface-card p-10 text-center"><span className={`mx-auto grid size-11 place-items-center rounded-full ${hasActiveFilters ? "bg-surface-inset text-text-muted" : "bg-positive-bg text-positive"}`}>{hasActiveFilters ? <Search size={17} /> : <Check size={18} />}</span><p className="mt-3 text-sm font-semibold">{hasActiveFilters ? "Nenhuma pendência corresponde aos filtros" : "Fila em dia"}</p><p className="mt-1 text-xs text-text-muted">{hasActiveFilters ? "Remova um filtro ou limpe a seleção para ver outras pendências." : "Não há valores em aberto nesta demonstração."}</p>{hasActiveFilters && <button type="button" onClick={onClearFilters} className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-control px-3 text-xs font-semibold text-accent hover:bg-accent-soft-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"><X size={14} />Limpar filtros</button>}</div>;
  return <div className={`${panel} overflow-hidden`}><div className="divide-y divide-border-subtle">{items.map((item, index) => {
    const saldo = Math.max(0, item.total - item.pago);
    const vencida = pendenciaVencida(item);
    const dias = diasAteVencimento(item);
    const proxima = !vencida && dias !== null && dias <= 7;
    return <motion.article layout key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_MICRO, delay: Math.min(index * .03, .18) }} className={`border-l-[3px] p-4 ${vencida ? "border-l-danger bg-danger-bg/15" : proxima ? "border-l-warning bg-warning-bg/20" : "border-l-transparent"}`}>
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 flex-1 items-start gap-3"><span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-md ${item.tipo === "A receber" ? "bg-accent-soft-bg text-accent" : "bg-surface-inset text-text-secondary"}`}>{item.tipo === "A receber" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.tipo === "A receber" ? "bg-accent-soft-bg text-accent" : "bg-surface-inset text-text-secondary"}`}>{item.tipo}</span>{vencida && <span className="rounded-full bg-danger-bg px-2 py-0.5 text-[10px] font-semibold text-danger">{vencimentoLabel(item)}</span>}{proxima && <span className="rounded-full bg-warning-bg px-2 py-0.5 text-[10px] font-semibold text-warning">{vencimentoLabel(item)}</span>}{item.recorrencia && <span className="rounded-full border border-border-default bg-surface-card px-2 py-0.5 text-[10px] text-text-muted">{item.recorrencia}</span>}</div><p className="mt-1.5 truncate text-sm font-semibold">{item.nome}</p><p className="mt-0.5 break-words text-xs leading-relaxed text-text-muted">{item.origem}</p><p className="mt-1 text-[11px] text-text-faint">{!vencida && !proxima ? vencimentoLabel(item) : `Criada ${dateLabel(item.criadaEm)}`}</p></div></div>
        <div className="min-w-[115px] text-right"><p className={`text-sm font-semibold tabular-nums ${vencida ? "text-danger" : proxima ? "text-warning" : "text-text-primary"}`}>{money(saldo)}</p><p className="mt-0.5 text-[10px] text-text-muted">de {money(item.total)}</p><p className="mt-0.5 text-[10px] text-text-faint">{item.pago > 0 ? `Pago ${money(item.pago)}` : "Sem pagamento"}</p></div>
      </div>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-2 border-t border-border-subtle pt-3"><div className="min-w-0 flex-1">{item.pagamentos?.length ? <div>
        <button type="button" aria-expanded={Boolean(historicoAberto[item.id])} onClick={() => setHistoricoAberto((current) => ({ ...current, [item.id]: !current[item.id] }))} className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-text-secondary underline-offset-2 hover:text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">Histórico de pagamentos · {item.pagamentos.length}<motion.span animate={{ rotate: historicoAberto[item.id] ? 180 : 0 }} transition={SPRING_MICRO}><ChevronDown size={13} /></motion.span></button>
        <AnimatePresence initial={false}>{historicoAberto[item.id] && <motion.ul initial={reduceMotion ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={reduceMotion ? undefined : { opacity: 0, height: 0 }} transition={reduceMotion ? { duration: 0 } : SPRING_MICRO} className="mt-1 overflow-hidden divide-y divide-border-subtle rounded-control border border-border-default bg-surface-card px-3">
          {item.pagamentos.map((pagamento, pagamentoIndex) => <li key={`${pagamento.meio}-${pagamento.ocorridoEm}-${pagamentoIndex}`} className="flex items-center gap-2 py-2 text-xs"><PaymentMethodMark meio={pagamento.meio} className="size-3.5 shrink-0 text-accent-soft-fg" /><span className="min-w-0 flex-1 text-text-secondary">{pagamento.meio} · {dateLabel(pagamento.ocorridoEm)}</span><strong className="shrink-0 tabular-nums text-text-primary">{money(pagamento.valor)}</strong></li>)}
        </motion.ul>}</AnimatePresence>
      </div> : <p className="inline-flex items-center gap-1.5 py-2 text-[11px] text-text-muted"><span aria-hidden="true" className="size-1.5 rounded-full bg-border-default" />Sem pagamentos registrados · saldo em aberto</p>}</div>{item.tipo === "A receber" && <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:justify-end"><button type="button" className="inline-flex min-h-11 items-center justify-center rounded-control border border-border-default bg-surface-card px-3 text-sm font-semibold text-text-secondary transition hover:border-accent/35 hover:bg-accent-soft-bg hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 sm:min-w-36" onClick={() => onAction({ tipo: "cobranca", pendencia: item })}>Revisar cobrança</button><Button type="button" variant="soft" size="mobile" className="text-sm sm:min-w-44" onClick={() => onAction({ tipo: "pagamento", pendencia: item })}>Registrar recebimento</Button></div>}</div>
    </motion.article>;
  })}</div></div>;
}

export function VendasPreview() {
  const [aba, setAba] = useState<AbaVendasPreview>("Visão geral");
  const [periodo, setPeriodo] = useState<PeriodoVendasPreview>("7 dias");
  const [vendas, setVendas] = useState(vendasDemoIniciais);
  const [movimentos, setMovimentos] = useState(movimentosDemoIniciais);
  const [pendencias, setPendencias] = useState(pendenciasDemoIniciais);
  const [busca, setBusca] = useState("");
  const [filtroSituacaoVenda, setFiltroSituacaoVenda] = useState("Todas");
  const [canaisVendaSelecionados, setCanaisVendaSelecionados] = useState<CanalVendaDemo[]>([]);
  const [meiosVendaSelecionados, setMeiosVendaSelecionados] = useState<MeioPagamentoDemo[]>([]);
  const [periodoVenda, setPeriodoVenda] = useState("Todos");
  const [clienteVenda, setClienteVenda] = useState("");
  const [produtoVenda, setProdutoVenda] = useState("");
  const [filtroMovimento, setFiltroMovimento] = useState("Todos");
  const [filtroPendencia, setFiltroPendencia] = useState("Todas");
  const [action, setAction] = useState<AcaoPreview | null>(null);
  const [saleDetail, setSaleDetail] = useState<VendaDemo | null>(null);
  const [toast, setToast] = useState("");
  const [periodoMovimento, setPeriodoMovimento] = useState<PeriodoMovimento>("todos");
  const [clientesSistema, setClientesSistema] = useState<Cliente[]>([]);
  const [motosClientesSistema, setMotosClientesSistema] = useState<ClienteMotoResumo[]>([]);
  const [statusClientes, setStatusClientes] = useState<StatusClientesPreview>("carregando");
  const rootRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const hostLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    const possuiSessao = Boolean(localStorage.getItem("auth_token"));
    if (!podeAtual("clientes.ver") || (!hostLocal && !possuiSessao)) {
      setStatusClientes("restrito");
      return;
    }

    let ativo = true;
    void Promise.all([
      fetchWithRetry("/api/clientes"),
      fetchWithRetry("/api/clientes/motos/todas"),
    ]).then(async ([clientesResponse, motosResponse]) => {
      if (clientesResponse.status === 403 || motosResponse.status === 403) {
        if (ativo) setStatusClientes("restrito");
        return;
      }
      if (!clientesResponse.ok || !motosResponse.ok) throw new Error("Falha ao consultar os cadastros.");
      const [clientesPayload, motosPayload] = await Promise.all([parseJson(clientesResponse), parseJson(motosResponse)]);
      if (!clientesPayload.success || !Array.isArray(clientesPayload.data) || !motosPayload.success || !Array.isArray(motosPayload.data)) {
        throw new Error("Resposta inválida ao consultar os cadastros.");
      }
      if (!ativo) return;
      setClientesSistema(clientesPayload.data as Cliente[]);
      setMotosClientesSistema(motosPayload.data as ClienteMotoResumo[]);
      setStatusClientes("pronto");
    }).catch(() => {
      if (ativo) setStatusClientes("erro");
    });

    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    if (reduceMotion || !rootRef.current) return;
    const nodes = rootRef.current.querySelectorAll<HTMLElement>("[data-preview-reveal]");
    const animation = animate(nodes, { opacity: [0, 1], translateY: [9, 0], delay: stagger(55), duration: 470, ease: "out(3)" });
    return () => { animation.pause(); };
  }, [aba, reduceMotion]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const vendasDoPeriodo = useMemo(() => {
    if (periodo === "Hoje") return vendas.filter((sale) => new Date(sale.ocorridoEm).toDateString() === new Date(2026, 8, 29).toDateString());
    if (periodo === "7 dias") return vendas.filter((sale) => Date.now() - new Date(sale.ocorridoEm).getTime() <= 7 * 86400000);
    if (periodo === "30 dias") return vendas.filter((sale) => Date.now() - new Date(sale.ocorridoEm).getTime() <= 30 * 86400000);
    return vendas.filter((sale) => new Date(sale.ocorridoEm).getMonth() === 8);
  }, [periodo, vendas]);

  const vendaFiltradas = useMemo(() => vendas.filter((sale) => {
    const texto = `${sale.id} ${sale.cliente} ${sale.item} ${sale.unidade}`.toLocaleLowerCase();
    const dias = Math.round((new Date(dataReferenciaDemo.getFullYear(), dataReferenciaDemo.getMonth(), dataReferenciaDemo.getDate()).getTime() - new Date(new Date(sale.ocorridoEm).getFullYear(), new Date(sale.ocorridoEm).getMonth(), new Date(sale.ocorridoEm).getDate()).getTime()) / umDia);
    const atendeStatus = filtroSituacaoVenda === "Todas" || (filtroSituacaoVenda === "Pagas" ? sale.recebido >= sale.valor : sale.recebido < sale.valor);
    const atendePeriodo = periodoVenda === "Todos" || (periodoVenda === "Hoje" ? dias === 0 : periodoVenda === "7 dias" ? dias >= 0 && dias <= 6 : periodoVenda === "30 dias" ? dias >= 0 && dias <= 29 : new Date(sale.ocorridoEm).getMonth() === dataReferenciaDemo.getMonth() && new Date(sale.ocorridoEm).getFullYear() === dataReferenciaDemo.getFullYear());
    const atendeCanal = canaisVendaSelecionados.length === 0 || canaisVendaSelecionados.includes(sale.canal);
    const atendePagamento = meiosVendaSelecionados.length === 0 || sale.pagamentos.some((pagamento) => meiosVendaSelecionados.includes(pagamento.meio));
    return texto.includes(busca.toLocaleLowerCase()) && sale.cliente.toLocaleLowerCase().includes(clienteVenda.toLocaleLowerCase()) && sale.item.toLocaleLowerCase().includes(produtoVenda.toLocaleLowerCase()) && atendeStatus && atendePeriodo && atendeCanal && atendePagamento;
  }), [busca, canaisVendaSelecionados, clienteVenda, filtroSituacaoVenda, meiosVendaSelecionados, periodoVenda, produtoVenda, vendas]);

  const filtrosVendaAtivos = useMemo(() => {
    const filtros: Array<{ id: string; label: string; clear: () => void }> = [];
    if (busca) filtros.push({ id: "busca", label: `Busca: ${busca}`, clear: () => setBusca("") });
    if (filtroSituacaoVenda !== "Todas") filtros.push({ id: "situacao", label: filtroSituacaoVenda === "Pagas" ? "Situação: pagas" : "Situação: com saldo", clear: () => setFiltroSituacaoVenda("Todas") });
    canaisVendaSelecionados.forEach((canal) => filtros.push({ id: `canal-${canal}`, label: `Canal: ${canal}`, clear: () => setCanaisVendaSelecionados((current) => current.filter((item) => item !== canal)) }));
    meiosVendaSelecionados.forEach((meio) => filtros.push({ id: `meio-${meio}`, label: `Pagamento: ${meio}`, clear: () => setMeiosVendaSelecionados((current) => current.filter((item) => item !== meio)) }));
    if (periodoVenda !== "Todos") filtros.push({ id: "periodo", label: `Período: ${periodoVenda}`, clear: () => setPeriodoVenda("Todos") });
    if (clienteVenda) filtros.push({ id: "cliente", label: `Cliente: ${clienteVenda}`, clear: () => setClienteVenda("") });
    if (produtoVenda) filtros.push({ id: "produto", label: `Peça: ${produtoVenda}`, clear: () => setProdutoVenda("") });
    return filtros;
  }, [busca, canaisVendaSelecionados, clienteVenda, filtroSituacaoVenda, meiosVendaSelecionados, periodoVenda, produtoVenda]);

  function limparFiltrosVenda() {
    setBusca("");
    setFiltroSituacaoVenda("Todas");
    setCanaisVendaSelecionados([]);
    setMeiosVendaSelecionados([]);
    setPeriodoVenda("Todos");
    setClienteVenda("");
    setProdutoVenda("");
  }

  function limparFiltrosPendencia() {
    setBusca("");
    setFiltroPendencia("Todas");
  }

  const movimentosFiltrados = useMemo(() => movimentos.filter((item) => {
    const texto = `${item.titulo} ${item.detalhe} ${item.metodo} ${item.origem}`.toLocaleLowerCase();
    const atendeTipo = filtroMovimento === "Todos" || item.tipo === (filtroMovimento === "Entradas" ? "entrada" : "saída");
    return atendeTipo && texto.includes(busca.toLocaleLowerCase());
  }).sort((a, b) => new Date(b.ocorridoEm).getTime() - new Date(a.ocorridoEm).getTime()), [busca, filtroMovimento, movimentos]);

  const pendenciasFiltradas = useMemo(() => pendencias.filter((item) => {
    const texto = `${item.nome} ${item.origem} ${item.tipo}`.toLocaleLowerCase();
    return item.pago < item.total && texto.includes(busca.toLocaleLowerCase()) && (filtroPendencia === "Todas" || item.tipo === filtroPendencia);
  }).sort((a, b) => Number(pendenciaVencida(b)) - Number(pendenciaVencida(a)) || new Date(a.venceEm ?? a.criadaEm).getTime() - new Date(b.venceEm ?? b.criadaEm).getTime()), [busca, filtroPendencia, pendencias]);

  const totalVendas = vendasDoPeriodo.reduce((sum, item) => sum + item.valor, 0);
  const totalReceber = pendencias.filter((item) => item.tipo === "A receber").reduce((sum, item) => sum + Math.max(0, item.total - item.pago), 0);
  const totalVencido = pendencias.filter((item) => item.tipo === "A receber" && pendenciaVencida(item)).reduce((sum, item) => sum + Math.max(0, item.total - item.pago), 0);
  const saldoCaixa = openingBalance + movimentos.reduce((sum, item) => sum + (item.tipo === "entrada" ? item.valor : -item.valor), 0);
  const contadorPendencias = pendencias.filter((item) => item.pago < item.total).length;

  function avisar(message: string) { setToast(message); }

  function confirmarAcao(result: AcaoConfirmada) {
    const ocorridoEm = new Date().toISOString();
    if (result.tipo === "venda") {
      const id = `V-${2842 + vendas.length - vendasDemoIniciais.length}`;
      const recebido = result.pagamentos.reduce((sum, payment) => sum + payment.valor, 0);
      const venda: VendaDemo = { id, cliente: result.cliente || "Balcão", item: result.item || "Peça demonstrativa", unidade: "UN-DEMO", ocorridoEm, valor: result.valor, recebido, pagamentos: result.pagamentos.map((payment) => ({ ...payment, ocorridoEm })), canal: "Balcão", grau: "B", temComprovantePix: result.pagamentos.some((payment) => payment.meio === "Pix") };
      setVendas((current) => [venda, ...current]);
      if (recebido > 0) setMovimentos((current) => [...result.pagamentos.filter((payment) => payment.valor > 0).map((payment) => ({ id: `MV-${Date.now()}-${payment.meio}`, titulo: venda.item, detalhe: `Venda ${id} · ${venda.cliente}`, ocorridoEm, tipo: "entrada" as const, valor: payment.valor, metodo: payment.meio, origem: "Venda" as const })), ...current]);
      if (result.valor > recebido) setPendencias((current) => [{ id: `P-${Date.now()}`, tipo: "A receber", nome: venda.cliente, origem: `${venda.item} · ${id}`, total: result.valor, pago: recebido, pagamentos: result.pagamentos.map((payment) => ({ ...payment, ocorridoEm })), venceEm: null, criadaEm: ocorridoEm }, ...current]);
      avisar("Venda demonstrativa adicionada. Nada foi gravado no sistema.");
    }
    if (result.tipo === "pagamento") {
      const item = pendencias.find((entry) => entry.id === result.pendenciaId);
      if (!item) return;
      const recebido = Math.min(Math.max(0, result.valor), item.total - item.pago);
      setPendencias((current) => current.map((entry) => entry.id === item.id ? { ...entry, pago: entry.pago + recebido, pagamentos: recebido > 0 ? [...(entry.pagamentos ?? []), { meio: result.meio, valor: recebido, ocorridoEm }] : entry.pagamentos, venceEm: entry.pago + recebido < entry.total && result.novoVencimento ? new Date(`${result.novoVencimento}T12:00:00`).toISOString() : entry.venceEm } : entry));
      const vendaId = item.origem.match(/V-\d+/)?.[0];
      if (vendaId && recebido > 0) setVendas((current) => current.map((sale) => sale.id === vendaId ? { ...sale, recebido: sale.recebido + recebido, pagamentos: [...sale.pagamentos, { meio: result.meio, valor: recebido, ocorridoEm }] } : sale));
      if (recebido > 0) setMovimentos((current) => [{ id: `MV-${Date.now()}`, titulo: "Recebimento de venda", detalhe: `${item.origem} · ${item.nome}`, ocorridoEm, tipo: "entrada", valor: recebido, metodo: result.meio, origem: "Recebimento" }, ...current]);
      avisar("Recebimento demonstrativo lançado; o saldo da pendência foi atualizado.");
    }
    if (result.tipo === "conta") {
      const due = result.vencimento ? new Date(`${result.vencimento}T12:00:00`).toISOString() : null;
      const occurrence = { id: `P-${Date.now()}`, tipo: "A pagar" as const, nome: result.nome, origem: result.descricao, total: result.valor, pago: 0, venceEm: due, criadaEm: ocorridoEm, ...(result.recorrencia !== "Sem recorrência" ? { recorrencia: result.recorrencia } : {}) };
      setPendencias((current) => [occurrence, ...current]);
      avisar(`Conta demonstrativa adicionada${result.recorrencia !== "Sem recorrência" ? ` · recorrência ${result.recorrencia.toLowerCase()}` : ""}.`);
    }
    if (result.tipo === "saida") {
      setMovimentos((current) => [{ id: `MV-${Date.now()}`, titulo: result.descricao, detalhe: "Lançamento manual · equipe", ocorridoEm, tipo: "saída", valor: result.valor, metodo: result.meio, origem: "Lançamento manual" }, ...current]);
      avisar("Saída demonstrativa adicionada ao histórico unificado.");
    }
    if (result.tipo === "cobranca-tratada") {
      setPendencias((current) => current.map((entry) => entry.id === result.pendenciaId ? { ...entry, lembreteTratado: true } : entry));
      avisar("Lembrete tratado. A dívida continua na fila.");
    }
    setAction(null);
  }

  function detalharVenda(sale: VendaDemo) {
    setSaleDetail(sale);
  }

  return <div ref={rootRef} style={previewTokens} data-project="rk-sucatas-new" className="min-h-screen min-w-0 overflow-x-hidden bg-surface-page font-[Geist,Inter,ui-sans-serif,system-ui] text-text-primary [&_button]:cursor-pointer">
    <style>{`@keyframes meli-sale-border { 0%, 100% { box-shadow: 0 0 0 0 rgba(231, 202, 0, 0); } 45% { box-shadow: 0 0 0 2px rgba(231, 202, 0, .2); } } .meli-sale-row, .meli-sale-highlight { transition: border-color .18s ease, box-shadow .18s ease; } @media (prefers-reduced-motion: no-preference) { .meli-sale-row:hover, .meli-sale-row:focus-visible, .meli-sale-highlight { animation: meli-sale-border .55s ease-out; } } @media (prefers-reduced-motion: reduce) { .meli-sale-row, .meli-sale-highlight { transition: none; animation: none; } }`}</style>
    <header className="sticky top-0 z-40 border-b border-border-default bg-surface-card/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-3 py-2.5 sm:px-6">
        <div className="grid size-8 shrink-0 place-items-center rounded-md bg-accent text-[10px] font-black text-white">RK</div>
        <div className="min-w-0"><p className="truncate text-sm font-semibold tracking-tight">RK Sucatas</p><p className="truncate font-mono text-[9px] uppercase tracking-[0.12em] text-text-faint">Vendas e financeiro · prévia local</p></div>
        <div className="ml-auto hidden items-center gap-2 rounded-full border border-border-default bg-surface-card px-3 py-1.5 text-[10px] font-semibold text-text-muted sm:flex"><DotMatrix sequence={[[0, 1, 3, 4, 6, 7, 9, 10, 12, 13, 15], [1, 4, 7, 10, 13]]} rows={4} cols={4} dotSize={2.5} gap={2} interval={900} color="#2563eb" inactiveColor="rgba(37,99,235,.15)" />Clientes reais · leitura</div>
        <button type="button" onClick={() => { setAba("Pendências"); setBusca(""); }} aria-label={`Abrir pendências (${contadorPendencias})`} className="relative ml-auto grid size-11 shrink-0 place-items-center rounded-control border border-border-default text-text-muted transition hover:bg-surface-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 sm:ml-0"><BellRing size={16} /><span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-warning px-1 font-mono text-[9px] text-white">{contadorPendencias}</span></button>
      </div>
    </header>

    <main className="mx-auto w-full max-w-[1440px] px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:py-8 lg:py-10">
      <div className="flex min-w-0 flex-col gap-4 border-b border-border-default lg:flex-row lg:items-end lg:justify-between">
        <div className="pb-4"><p className={label}>Operação comercial · vendas, caixa e recebimentos</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Vendas</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">Acompanhe o que entrou, o que saiu e o que ainda precisa de atenção.</p></div>
        <div className="-mx-3 flex max-w-full overflow-x-auto px-3 pb-0 sm:mx-0 sm:px-0"><SegmentTabs value={aba} onValueChange={(value) => { setAba(value as AbaVendasPreview); setBusca(""); }}><SegmentTabsList aria-label="Visões de vendas" className="max-w-full shrink-0 bg-slate-50">{abas.map((tab, index) => <SegmentTabsTrigger key={tab} value={tab} id={`vendas-tab-${index}`} aria-controls="vendas-preview-panel" className="min-h-11 shrink-0 whitespace-nowrap px-3 py-2 text-sm">{tab}{tab === "Pendências" && <span className="ml-1 text-[11px] text-slate-400">{contadorPendencias}</span>}</SegmentTabsTrigger>)}</SegmentTabsList></SegmentTabs></div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-warning/30 bg-warning-bg px-3 py-1.5 text-[10px] font-semibold text-warning sm:hidden"><span className="size-1.5 rounded-full bg-warning" />Clientes reais em leitura · valores demonstrativos</div>
        <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {aba === "Visão geral" && <div className="w-36"><Select ariaLabel="Período do resumo" value={periodo} onChange={(value) => setPeriodo(value as PeriodoVendasPreview)} options={["Hoje", "7 dias", "30 dias", "Este mês"].map((value) => ({ value, label: value }))} size="lg" /></div>}
          <Button type="button" variant="default" size="mobile" className="min-h-11 flex-1 bg-accent text-white shadow-sm transition-colors hover:bg-accent-hover active:bg-accent-hover sm:flex-none" onClick={() => setAction({ tipo: "venda" })}><Plus size={16} />Nova venda</Button>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.section key={aba} id="vendas-preview-panel" role="tabpanel" aria-labelledby={`vendas-tab-${abas.indexOf(aba)}`} tabIndex={0} initial={reduceMotion ? false : { opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -4 }} transition={{ duration: reduceMotion ? 0 : .18 }} className="mt-6 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">
          {aba === "Visão geral" && <Overview period={periodo} sales={totalVendas} balance={saldoCaixa} receivable={totalReceber} overdue={totalVencido} pendencies={pendencias} salesRows={vendasDoPeriodo} movementRows={movimentos} onOpenTab={setAba} />}

          {aba === "Vendas" && <div className="space-y-4">
            <SectionTitle eyebrow="Registro e consulta" title="Vendas recentes" aside={<span className="font-mono text-[10px] uppercase tracking-wide text-text-faint">{vendaFiltradas.length} exemplos</span>} />
            <div className="space-y-2.5">
              <label className="relative block min-w-0"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" size={15} /><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar cliente, peça ou código" className={`${inputClass} pl-9`} /></label>
              <div className="flex flex-wrap items-center gap-2">
                <div role="group" aria-label="Filtrar vendas por situação" className="inline-flex min-h-11 items-center gap-0.5 rounded-control border border-border-default bg-surface-inset p-1">
                  {["Todas", "Pagas", "Com saldo"].map((status) => <button key={status} type="button" aria-pressed={filtroSituacaoVenda === status} onClick={() => setFiltroSituacaoVenda(status)} className={`min-h-9 rounded-[4px] px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 sm:px-3 ${filtroSituacaoVenda === status ? "bg-surface-card text-accent shadow-sm" : "text-text-muted hover:text-text-primary"}`}>{status}</button>)}
                </div>
                <MultiFilter label="Canal" selected={canaisVendaSelecionados} options={["Balcão", "WhatsApp", "Mercado Livre"]} onChange={(values) => setCanaisVendaSelecionados(values as CanalVendaDemo[])} />
                <MultiFilter label="Pagamento" selected={meiosVendaSelecionados} options={["Pix", "Dinheiro", "Cartão de débito", "Cartão de crédito"]} onChange={(values) => setMeiosVendaSelecionados(values as MeioPagamentoDemo[])} />
                <PopoverRoot variant="subtle">
                  <PopoverTrigger className={`${control} h-11 md:h-11 normal-case tracking-normal bg-surface-card`}><SlidersHorizontal size={14} />Mais filtros{(periodoVenda !== "Todos" || clienteVenda || produtoVenda) && <span className="grid min-w-5 place-items-center rounded-full bg-accent-soft-bg px-1.5 py-0.5 font-mono text-[10px] text-accent">{Number(periodoVenda !== "Todos") + Number(Boolean(clienteVenda)) + Number(Boolean(produtoVenda))}</span>}<ChevronDown size={14} className="text-text-faint" /></PopoverTrigger>
                  <PopoverContent className="left-auto right-0 grid w-[min(20rem,calc(100vw-2rem))] gap-3 p-4">
                    <Select label="Período" value={periodoVenda} onChange={setPeriodoVenda} options={["Todos", "Hoje", "7 dias", "30 dias", "Este mês"].map((value) => ({ value, label: value }))} size="lg" />
                    <label className="text-xs font-semibold text-text-secondary">Cliente<input value={clienteVenda} onChange={(event) => setClienteVenda(event.target.value)} placeholder="Nome do cliente" className={`${inputClass} mt-1.5`} /></label>
                    <label className="text-xs font-semibold text-text-secondary">Peça<input value={produtoVenda} onChange={(event) => setProdutoVenda(event.target.value)} placeholder="Nome da peça" className={`${inputClass} mt-1.5`} /></label>
                  </PopoverContent>
                </PopoverRoot>
              </div>
              {filtrosVendaAtivos.length > 0 && <div className="flex flex-wrap items-center gap-1.5" aria-label="Filtros ativos">{filtrosVendaAtivos.map((filtro) => <FilterChip key={filtro.id} onRemove={filtro.clear}>{filtro.label}</FilterChip>)}<button type="button" onClick={limparFiltrosVenda} className="min-h-8 px-2 text-[11px] font-semibold text-text-muted underline-offset-2 hover:text-text-primary hover:underline">Limpar filtros</button></div>}
            </div>
            <SalesList sales={vendaFiltradas} onDetail={detalharVenda} onClearFilters={limparFiltrosVenda} />
            <section className={`${panel} p-4 sm:p-5`}><SectionTitle eyebrow="Fluxo de registro" title="Vinculada a Clientes e Estoque" /><p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">Selecione uma unidade física, escolha uma ou mais formas de pagamento e confira total, recebido e saldo antes de confirmar. Os exemplos de comprovante Pix aparecem no detalhe da venda.</p></section>
          </div>}

          {aba === "Movimentações" && <div className="space-y-4">
            <SectionTitle eyebrow="Histórico cronológico" title="Entradas e saídas" aside={<Button type="button" variant="soft" size="mobile" onClick={() => setAction({ tipo: "saida" })}><Plus size={15} />Registrar saída</Button>} />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center"><label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" size={15} /><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar origem, descrição ou pagamento" className={`${inputClass} pl-9`} /></label><div className="sm:w-48"><Select ariaLabel="Filtrar movimentações" value={filtroMovimento} onChange={setFiltroMovimento} options={["Todos", "Entradas", "Saídas"].map((value) => ({ value, label: value }))} size="lg" /></div><SegmentTabs value={periodoMovimento} onValueChange={(value) => setPeriodoMovimento(value as PeriodoMovimento)} className="w-full sm:w-auto"><SegmentTabsList aria-label="Período das movimentações" className="w-full max-w-full shrink-0 bg-surface-inset sm:w-auto"><SegmentTabsTrigger value="todos" className="min-h-9 flex-1 whitespace-nowrap px-3 text-xs sm:flex-none">Todos os exemplos</SegmentTabsTrigger><SegmentTabsTrigger value="sete-dias" className="min-h-9 flex-1 whitespace-nowrap px-3 text-xs sm:flex-none">7 dias</SegmentTabsTrigger></SegmentTabsList></SegmentTabs></div>
            <p className="text-xs leading-5 text-text-muted">Um histórico cronológico para vendas, recebimentos parciais, contas pagas e lançamentos manuais.</p>
            <MovementsList items={filtrarMovimentosPorPeriodo(movimentosFiltrados, periodoMovimento)} />
            <div className={`${panel} flex flex-wrap items-center justify-between gap-2 p-4 text-xs`}><span className="text-text-muted">Saldo líquido destes movimentos de exemplo</span><strong className="text-positive tabular-nums">{money(movimentosFiltrados.reduce((sum, item) => sum + (item.tipo === "entrada" ? item.valor : -item.valor), 0))}</strong></div>
          </div>}

          {aba === "Pendências" && <div className="space-y-4">
            <SectionTitle eyebrow="Fila única · receber e pagar" title="Pendências" aside={<Button type="button" variant="soft" size="mobile" onClick={() => setAction({ tipo: "conta" })}><Plus size={15} />Adicionar conta</Button>} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><div className={`${panel} p-3.5 sm:p-4`}><p className={label}>A receber</p><p className="mt-2 text-xl font-semibold tabular-nums">{money(totalReceber)}</p><p className="mt-1 text-[11px] text-text-muted">Saldo aberto de clientes</p></div><div className={`${panel} p-3.5 sm:p-4`}><p className={label}>A pagar</p><p className="mt-2 text-xl font-semibold tabular-nums">{money(pendencias.filter((p) => p.tipo === "A pagar").reduce((sum, p) => sum + Math.max(0, p.total - p.pago), 0))}</p><p className="mt-1 text-[11px] text-text-muted">Contas da empresa</p></div><div className={`${panel} col-span-2 p-3.5 sm:col-span-1 sm:p-4`}><p className={label}>Lembretes internos</p><p className="mt-2 text-sm font-semibold">Visíveis só para a equipe</p><p className="mt-1 text-[11px] text-text-muted">Sem envio automático ao cliente</p></div></div>
            <div className="flex flex-col gap-2 sm:flex-row"><label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" size={15} /><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar cliente, fornecedor ou origem" className={`${inputClass} pl-9`} /></label><div className="sm:w-48"><Select ariaLabel="Filtrar pendências" value={filtroPendencia} onChange={setFiltroPendencia} options={["Todas", "A receber", "A pagar"].map((value) => ({ value, label: value }))} size="lg" /></div></div>
            <PendingList items={pendenciasFiltradas} onAction={setAction} hasActiveFilters={Boolean(busca) || filtroPendencia !== "Todas"} onClearFilters={limparFiltrosPendencia} />
            <p className="rounded-control border border-border-default bg-surface-inset px-4 py-3 text-xs leading-5 text-text-muted">Marcar a cobrança como tratada encerra o destaque; a pendência permanece aberta até a quitação. Pagamento parcial reduz o saldo e permite definir novo vencimento.</p>
          </div>}
        </motion.section>
      </AnimatePresence>

    <div className="mt-6 rounded-control border border-border-default bg-surface-inset px-4 py-3 text-xs leading-5 text-text-muted"><strong className="font-semibold text-text-secondary">Preview local.</strong> Clientes e motos são consultados em modo somente leitura. Valores, gráficos e lançamentos são demonstrativos; ações alteram apenas esta prévia no navegador.</div>
    </main>

    <AnimatePresence>{toast && <motion.div role="status" aria-live="polite" initial={reduceMotion ? false : { opacity: 0, y: 12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduceMotion ? undefined : { opacity: 0, y: 8, scale: .98 }} transition={SPRING_MICRO} className="fixed bottom-5 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-control border border-border-default bg-surface-card px-4 py-3 text-center text-sm font-semibold shadow-lg">{toast}</motion.div>}</AnimatePresence>
    <ActionDrawer action={action} onClose={() => setAction(null)} onConfirm={confirmarAcao} clientes={clientesSistema} motosClientes={motosClientesSistema} statusClientes={statusClientes} />
    <SaleDetailDrawer sale={saleDetail} onClose={() => setSaleDetail(null)} />
    <footer className="border-t border-border-default bg-surface-card px-4 py-4 text-center font-mono text-[9px] uppercase tracking-[0.12em] text-text-faint">RK Sucatas · prévia comercial · cadastros em leitura · sem gravação</footer>
  </div>;
}
