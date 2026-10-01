import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { animate, stagger } from "animejs";
import {
  ArrowDownLeft, ArrowUpRight, BellRing, Check, Plus,
  ChevronDown, ChevronRight, FileImage, Trash2,
  Pencil, Search, SlidersHorizontal, X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { lightInventoryTokens } from "../estoque-preview/InventoryDrawer";
import { Select } from "@/src/components/ui/Select";
import { PopoverContent, PopoverHeader, PopoverRoot, PopoverTrigger } from "@/src/components/ui/popover";
import { SPRING_MICRO } from "@/src/components/ui/motion";
import { podeAtual } from "@/src/hooks/usePermissao";
import { vendasApi } from "@/src/features/vendas/api";
import type { Venda } from "@/src/features/vendas/types";
import { caixaApi, caixaPendenciasApi } from "@/src/features/caixa/api";
import type { CaixaEntry, CaixaPendencia, CaixaPendenciaRecebimento, CaixaTipo } from "@/src/features/caixa/types";
import { fiadoApi } from "@/src/features/fiado/api";
import type { FiadoRecebimento } from "@/src/features/fiado/types";
import {
  type AbaVendasPreview, type CanalVendaDemo, type MeioPagamentoDemo, type MovimentoDemo,
  type PendenciaDemo, type PeriodoVendasPreview, parseDataLocal,
} from "./data";
import type { SaleViewModel } from "./salesViewModel";
import { mapearMovimentos, mapearPendencias, mapearVendas } from "./liveData";
import { CashFlowChart, SalesTrendChart } from "./components/SalesCharts";
import { OverviewMetrics } from "./components/OverviewMetrics";
import { SaleDetailDrawer } from "./components/SaleDetailDrawer";
import { PendingEditDrawer } from "./components/PendingEditDrawer";
import { MovementActionDrawer } from "./components/MovementActionDrawer";
import { PendingCreateDrawer } from "./components/PendingCreateDrawer";
import { PendingReceivableDrawer } from "./components/PendingReceivableDrawer";
import { MercadoLivreBadge, PaymentMethodMark } from "./components/PaymentMarks";
import { Tabs as SegmentTabs, TabsList as SegmentTabsList, TabsTrigger as SegmentTabsTrigger } from "../tarefas-preview/PreviewTabs";
import { filtrarMovimentosPorPeriodo, type PeriodoMovimento } from "./movementFilters";
import { buildSalesOverview } from "./overviewModel";

const NovaVendaDrawer = lazy(() => import("@/src/features/vendas/VendasView").then((mod) => ({ default: mod.NovaVendaDrawer })));

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
const umDia = 86400000;
type DataStatus = "carregando" | "pronto" | "restrito" | "erro";

function intervaloDoResumo(periodo: PeriodoVendasPreview) {
  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const inicio = periodo === "Hoje" ? hoje
    : periodo === "Este mês" ? new Date(agora.getFullYear(), agora.getMonth(), 1)
      : new Date(hoje.getTime() - 29 * umDia);
  const dias = Math.max(1, Math.floor((hoje.getTime() - inicio.getTime()) / umDia) + 1);
  return { agora, inicio, dias };
}

function dateLabel(iso: string) {
  const date = parseDataLocal(iso);
  const now = new Date();
  const days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86400000);
  const relativo = days === 0 ? "Hoje" : days === 1 ? "Ontem" : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? relativo : `${relativo}, ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function dataLimitePendencia(item: PendenciaDemo) {
  return item.venceEm ? parseDataLocal(item.venceEm) : new Date(parseDataLocal(item.criadaEm).getTime() + 30 * 86400000);
}

function diasEmAberto(item: PendenciaDemo) {
  const abertaEm = parseDataLocal(item.criadaEm);
  const hoje = new Date();
  abertaEm.setHours(0, 0, 0, 0);
  hoje.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((hoje.getTime() - abertaEm.getTime()) / umDia));
}

function diasAteVencimento(item: PendenciaDemo) {
  if (!item.venceEm && item.tipo === "A pagar") return null;
  if (!item.venceEm && item.tipo === "A receber") return 30 - diasEmAberto(item);
  const limite = dataLimitePendencia(item);
  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
    const vencimento = new Date(limite.getFullYear(), limite.getMonth(), limite.getDate()).getTime();
  return Math.round((vencimento - hoje) / umDia);
}

function pendenciaVencida(item: PendenciaDemo) {
  if (item.pago >= item.total) return false;
  if (!item.venceEm && item.tipo === "A receber") return diasEmAberto(item) >= 30;
  const dias = diasAteVencimento(item);
  return dias !== null && dias < 0;
}

function vencimentoLabel(item: PendenciaDemo) {
  if (!item.venceEm && item.tipo === "A receber") {
    const dias = diasEmAberto(item);
    return dias >= 30 ? `Atrasada · ${dias} dias em aberto` : `Em aberto há ${dias} dias · atraso após 30 dias`;
  }
  if (!item.venceEm) return "Sem vencimento informado";
  const dias = diasAteVencimento(item) ?? 0;
  return dias < 0 ? `Vencida há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? "dia" : "dias"}` : dias === 0 ? "Vence hoje" : `Vence em ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

function pendenciaUrgente(item: PendenciaDemo) {
  if (item.pago >= item.total) return false;
  return pendenciaVencida(item);
}

function SectionTitle({ eyebrow, title, aside }: { eyebrow: string; title: string; aside?: ReactNode }) {
  return <div className="flex flex-wrap items-end justify-between gap-3"><div><p className={label}>{eyebrow}</p><h2 className="mt-1 text-lg font-semibold tracking-tight text-text-primary">{title}</h2></div>{aside}</div>;
}

function DataNotice({ status, area, detail }: { status: DataStatus; area: string; detail?: string }) {
  const loading = status === "carregando";
  const restricted = status === "restrito";
  return <div role={loading ? "status" : "alert"} className={`${panel} flex min-h-40 flex-col items-center justify-center gap-2 border-dashed px-6 py-8 text-center`}>
    <span className="text-sm font-semibold">{loading ? `Carregando ${area}…` : restricted ? `Sem acesso aos dados de ${area}` : `Não foi possível carregar ${area}`}</span>
    <span className="max-w-lg text-xs leading-5 text-text-muted">{loading ? "Consultando os registros." : restricted ? "Seu perfil precisa da permissão correspondente para consultar esta área." : detail || "Atualize a página para tentar consultar os dados novamente."}</span>
    {status === "erro" && <button type="button" onClick={() => window.location.reload()} className="mt-1 min-h-10 rounded-control px-3 text-xs font-semibold text-accent hover:bg-accent-soft-bg">Tentar novamente</button>}
  </div>;
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
  period, periodDays, sales, salesCount, cashIn, cashInCount, receivable, overdue, balance, pendencies, salesRows, movementRows, financialAvailable, onOpenTab,
}: {
  period: string; periodDays: number; sales: number; salesCount: number; cashIn: number | null; cashInCount: number | null; receivable: number | null; overdue: number | null; balance: number | null;
  pendencies: PendenciaDemo[]; salesRows: SaleViewModel[]; movementRows: MovimentoDemo[]; financialAvailable: boolean; onOpenTab: (tab: AbaVendasPreview) => void;
}) {
  const attention = pendencies.filter(pendenciaUrgente).sort((a, b) => (diasAteVencimento(a) ?? 99) - (diasAteVencimento(b) ?? 99));
  const pendenciasAbertas = pendencies.filter((item) => item.pago < item.total);
  const aging = [
    { label: "Em aberto · 0–7d", count: pendenciasAbertas.filter((p) => diasEmAberto(p) <= 7).length, tone: "bg-slate-400" },
    { label: "Em aberto · 8–29d", count: pendenciasAbertas.filter((p) => diasEmAberto(p) >= 8 && diasEmAberto(p) < 30).length, tone: "bg-warning" },
    { label: "Atraso · 30–59d", count: pendenciasAbertas.filter((p) => diasEmAberto(p) >= 30 && diasEmAberto(p) < 60).length, tone: "bg-danger/80" },
    { label: "Atraso · 60+d", count: pendenciasAbertas.filter((p) => diasEmAberto(p) >= 60).length, tone: "bg-danger" },
  ];
  const ageTotal = Math.max(1, aging.reduce((sum, item) => sum + item.count, 0));

  return <div className="space-y-6">
    <OverviewMetrics sales={sales} salesCount={salesCount} cashIn={cashIn} cashInCount={cashInCount} balance={balance} receivable={receivable} overdue={overdue} cashAvailable={financialAvailable} periodLabel={period.toLowerCase()} />

    <section data-preview-reveal className={`${panel} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 sm:px-5">
        <div><p className={label}>Histórico</p><h2 className="mt-1 text-base font-semibold">Últimas vendas <span className="ml-1 font-mono text-xs font-normal text-text-muted">{salesRows.length}</span></h2></div>
        <button type="button" onClick={() => onOpenTab("Vendas")} className="inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-accent hover:underline">Ver histórico<ChevronRight size={14} /></button>
      </div>
      {salesRows.length ? <div className="divide-y divide-border-subtle">{salesRows.slice(0, 4).map((sale) => <div key={sale.id} className="flex min-w-0 items-center justify-between gap-3 px-4 py-3 sm:px-5"><div className="min-w-0"><p className="truncate text-sm font-semibold text-text-primary">{sale.item}</p><p className="mt-0.5 truncate text-xs text-text-muted">{sale.cliente} · {dateLabel(sale.ocorridoEm)}</p></div><strong className="shrink-0 text-sm tabular-nums text-text-primary">{money(sale.valor)}</strong></div>)}</div> : <p className="px-4 py-7 text-center text-sm text-text-muted">Nenhuma venda registrada.</p>}
    </section>

    <AnimatePresence initial={false}>
      {attention.length > 0 && <motion.section key="attention" aria-label="Pendências urgentes" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={SPRING_MICRO} className="overflow-hidden rounded-card border border-border-default bg-surface-card shadow-sm">
        <div className="flex flex-col gap-4 border-l-[3px] border-l-danger p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div className="flex min-w-0 items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-control bg-danger-bg text-danger"><BellRing size={17} /></span><div className="min-w-0"><p className="text-sm font-semibold text-text-primary">{attention.length} {attention.length === 1 ? "recebível precisa" : "recebíveis precisam"} de revisão</p><div className="mt-2 flex flex-wrap gap-2">{attention.slice(0, 2).map((item) => <span key={item.id} className="inline-flex max-w-full flex-wrap items-center gap-x-1.5 rounded-full border border-border-default bg-surface-inset px-2.5 py-1 text-xs text-text-secondary"><strong className="font-semibold text-text-primary">{item.nome}</strong><span>·</span><span>{money(item.total - item.pago)}</span><span>·</span><span className={pendenciaVencida(item) ? "font-semibold text-danger" : "font-semibold text-warning"}>{vencimentoLabel(item)}</span></span>)}</div><p className="mt-2 text-[11px] text-text-muted">Recebíveis abertos há 30 dias ou mais aparecem como atrasados.</p></div></div><button type="button" className={`${control} w-full shrink-0 sm:w-auto`} onClick={() => onOpenTab("Pendências")}>Revisar pendências<ChevronRight size={15} /></button></div>
      </motion.section>}
    </AnimatePresence>

    <div className="grid min-w-0 gap-4 xl:grid-cols-[1.25fr_.95fr]">
      <section data-preview-reveal className={`${panel} min-w-0 p-4 sm:p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className={label}>Desempenho comercial</p><h2 className="mt-1 text-base font-semibold">Ritmo de vendas</h2><p className="mt-1 text-xs text-text-muted">{period} comparado ao período anterior</p></div><div className="text-right"><p className="text-xl font-semibold tracking-tight">{money(sales)}</p><span className="mt-1 inline-flex items-center gap-1 text-xs text-text-muted">{salesCount} {salesCount === 1 ? "venda" : "vendas"}</span></div></div>
        <SalesTrendChart sales={salesRows} days={periodDays} periodLabel={period} />
      </section>
      <section data-preview-reveal className={`${panel} min-w-0 p-4 sm:p-5`}>
        <div><p className={label}>Caixa em movimento</p><h2 className="mt-1 text-base font-semibold">Entradas, saídas e saldo líquido</h2><p className="mt-1 text-xs text-text-muted">{financialAvailable ? `Lançamentos efetivos · ${period.toLowerCase()}` : "Requer acesso à aba Caixa"}</p></div>
        {financialAvailable ? <CashFlowChart items={movementRows} days={periodDays} /> : <p className="mt-4 grid h-[232px] place-items-center rounded-control border border-dashed border-border-default text-sm text-text-muted">Dados financeiros indisponíveis para este perfil.</p>}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-text-muted"><span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-sm bg-accent" />Entradas</span><span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-sm bg-slate-300" />Saídas</span><span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-positive" />Saldo líquido</span></div>
      </section>
    </div>

    {financialAvailable ? <div className="grid min-w-0 gap-4 xl:grid-cols-[.9fr_1.1fr]">
      <section data-preview-reveal className={`${panel} min-w-0 p-4 sm:p-5`}>
        <SectionTitle eyebrow="Idade das pendências" title="O que vem primeiro" aside={<button type="button" onClick={() => onOpenTab("Pendências")} className="inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-accent">Abrir fila<ChevronRight size={14} /></button>} />
        <div className="mt-5 space-y-3.5">{aging.map((bucket) => <div className="flex items-center gap-3" key={bucket.label}><span className="w-24 shrink-0 text-xs text-text-secondary">{bucket.label}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-inset"><motion.div initial={{ width: 0 }} animate={{ width: `${bucket.count ? Math.max(12, (bucket.count / ageTotal) * 100) : 0}%` }} transition={{ duration: .55, ease: "easeOut" }} className={`h-full rounded-full ${bucket.tone}`} /></div><span className="w-5 text-right font-mono text-xs font-semibold tabular-nums">{bucket.count}</span></div>)}</div>
        <p className="mt-5 border-t border-border-subtle pt-3 text-[11px] leading-5 text-text-muted">A tela do Caixa classifica como atraso os recebíveis que permanecem abertos por 30 dias ou mais.</p>
      </section>
      <section data-preview-reveal className={`${panel} min-w-0 p-4 sm:p-5`}>
        <SectionTitle eyebrow="Recebíveis em aberto" title="Mais antigos primeiro" aside={<button type="button" onClick={() => onOpenTab("Pendências")} className="inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-accent">Ver todos<ChevronRight size={14} /></button>} />
        <div className="mt-3 divide-y divide-border-subtle">{pendencies.filter((item) => item.pago < item.total).slice(0, 4).map((item) => <div key={item.id} className="flex min-w-0 items-center justify-between gap-3 py-3"><div className="flex min-w-0 items-center gap-2.5"><span className="grid size-8 shrink-0 place-items-center rounded-md bg-accent-soft-bg text-accent"><ArrowDownLeft size={15} /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.nome}</p><p className="mt-0.5 truncate text-xs text-text-muted">{vencimentoLabel(item)}</p></div></div><p className="shrink-0 text-sm font-semibold tabular-nums">{money(item.total - item.pago)}</p></div>)}</div>
      </section>
    </div> : <p className={`${panel} px-4 py-8 text-center text-sm text-text-muted`}>Resumo de recebíveis indisponível para este perfil. Consulte um usuário com acesso ao Caixa.</p>}
  </div>;
}

function SalesList({ sales, onDetail, onClearFilters, hasActiveFilters }: { sales: SaleViewModel[]; onDetail: (sale: SaleViewModel) => void; onClearFilters: () => void; hasActiveFilters: boolean }) {
  const [visibleCount, setVisibleCount] = useState(40);
  useEffect(() => setVisibleCount(40), [sales]);
  if (sales.length === 0) return <div className="rounded-card border border-dashed border-border-default bg-surface-card p-10 text-center"><span className="mx-auto grid size-11 place-items-center rounded-full bg-surface-inset text-text-muted"><Search size={17} /></span><p className="mt-3 text-sm font-semibold">{hasActiveFilters ? "Nenhuma venda corresponde aos filtros" : "Nenhuma venda registrada"}</p><p className="mt-1 text-xs text-text-muted">{hasActiveFilters ? "Remova um filtro para ver outros registros." : "O histórico será exibido quando houver uma venda."}</p>{hasActiveFilters && <button type="button" onClick={onClearFilters} className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-control px-3 text-xs font-semibold text-accent hover:bg-accent-soft-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"><X size={14} />Limpar filtros</button>}</div>;
  return <div className={`${panel} overflow-hidden`}>
    <div className="hidden grid-cols-[1.15fr_1.65fr_1fr_.8fr_.9fr] gap-3 bg-surface-inset px-4 py-3 md:grid"><span className={label}>Cliente · canal</span><span className={label}>Peça · unidade</span><span className={label}>Pagamento recebido</span><span className={`${label} text-right`}>Valor</span><span className={`${label} text-right`}>Estado</span></div>
    <div className="divide-y divide-border-subtle">{sales.slice(0, visibleCount).map((sale, index) => <motion.button key={sale.id} type="button" aria-label={`Abrir detalhes da venda ${sale.id}, cliente ${sale.cliente}`} onClick={() => onDetail(sale)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_MICRO, delay: Math.min(index * .035, .18) }} className={`grid w-full min-w-0 gap-2 p-4 text-left transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 md:grid-cols-[1.15fr_1.65fr_1fr_.8fr_.9fr] md:items-center md:gap-3 ${sale.canal === "Mercado Livre" ? "meli-sale-row rounded-control border border-[#e7ca00] bg-amber-50/20" : ""}`}>
      <span className="min-w-0"><span className="block truncate text-sm font-semibold">{sale.cliente}</span><span className="mt-0.5 block font-mono text-[10px] text-text-faint">{sale.id} · {dateLabel(sale.ocorridoEm)}</span><span className="mt-1 block"><MercadoLivreBadge canal={sale.canal} compact /></span></span>
      <span className="min-w-0"><span className="block break-words text-sm text-text-secondary">{sale.item}</span><span className="mt-0.5 block font-mono text-[10px] text-text-faint">Unidade {sale.unidade}{sale.grau !== "—" ? ` · Grau ${sale.grau}` : ""}</span></span>
      <span className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-text-muted">{sale.pagamentos.length ? sale.pagamentos.map((pagamento, pagamentoIndex) => <span key={`${pagamento.meio}-${pagamentoIndex}`} title={`${pagamento.meio}: ${money(pagamento.valor)}`} className="inline-flex items-center gap-1"><PaymentMethodMark meio={pagamento.meio} className="size-3.5" />{pagamento.meio}</span>) : <span>{sale.reconciliation.kind === "unavailable" ? "Financeiro restrito" : sale.reconciliation.kind === "needs-review" ? `Sem lançamento no Caixa${sale.reconciliation.recordedMethod ? ` · ${sale.reconciliation.recordedMethod}` : ""}` : "Sem pagamento"}</span>}{sale.temComprovantePix && <span className="inline-flex items-center gap-1 text-text-faint"><FileImage size={12} />Comprovante</span>}</span>
      <span className="text-sm font-semibold tabular-nums md:text-right">{money(sale.valor)}{sale.canal === "Mercado Livre" && sale.recebido != null && <span className="mt-0.5 block text-[10px] font-medium text-text-muted">Líquido recebido {money(sale.recebido)}</span>}</span>
      <span className={`w-fit rounded-full px-2 py-1 text-[10px] font-semibold md:ml-auto ${sale.reconciliation.kind === "unavailable" ? "bg-surface-inset text-text-muted" : sale.reconciliation.kind === "settled" ? "bg-positive-bg text-positive" : sale.reconciliation.kind === "needs-review" ? "bg-info-bg text-info" : "bg-warning-bg text-warning"}`}>{sale.reconciliation.kind === "unavailable" ? "Financeiro restrito" : sale.reconciliation.kind === "settled" ? "Pago" : sale.reconciliation.kind === "needs-review" ? "Conciliação necessária" : `Saldo ${money(sale.reconciliation.outstanding)}`}</span>
    </motion.button>)}</div>
    {visibleCount < sales.length && <button type="button" onClick={() => setVisibleCount((count) => count + 40)} className="flex min-h-11 w-full items-center justify-center border-t border-border-default px-4 text-xs font-semibold text-accent transition-colors hover:bg-surface-raised">Mostrar mais vendas ({sales.length - visibleCount} restantes)</button>}
  </div>;
}

function MovementsList({ items, canDelete, onDelete }: { items: MovimentoDemo[]; canDelete: (item: MovimentoDemo) => boolean; onDelete: (item: MovimentoDemo) => void }) {
  const reduceMotion = useReducedMotion();
  const [pendingDelete, setPendingDelete] = useState<MovimentoDemo | null>(null);
  return <>
    <div className={`${panel} overflow-hidden`}><div className="divide-y divide-border-subtle"><AnimatePresence initial={false} mode="popLayout">{items.map((item) => <motion.div layout key={item.id} initial={reduceMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -4 }} transition={reduceMotion ? { duration: 0 } : { ...SPRING_MICRO, duration: .16 }} className={`flex min-w-0 flex-wrap items-center gap-3 p-4 ${item.tipo === "saída" ? "border-l-[3px] border-l-negative/70 bg-negative-bg/20" : ""}`}>
      <span className={`grid size-10 shrink-0 place-items-center rounded-md ${item.tipo === "entrada" ? "bg-positive-bg text-positive" : "bg-negative-bg text-negative"}`}>{item.tipo === "entrada" ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</span>
      <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold">{item.titulo}</span><span className="mt-1 block break-words text-xs text-text-muted">{item.detalhe} · {dateLabel(item.ocorridoEm)}</span><span className="mt-1 block font-mono text-[9px] uppercase tracking-wide text-text-faint">{item.origem}</span></span>
      <span className="ml-auto flex shrink-0 items-center gap-3 text-right"><span><span className={`block text-sm font-semibold tabular-nums ${item.tipo === "entrada" ? "text-positive" : "text-negative"}`}>{item.tipo === "entrada" ? "+" : "−"}{money(item.valor)}</span><span className="mt-1 inline-flex items-center justify-end gap-1 text-[10px] text-text-faint">{meiosDoRotulo(item.metodo).map((meio, meioIndex) => <PaymentMethodMark key={`${meio}-${meioIndex}`} meio={meio} className="size-3" />)}{item.metodo}</span></span>{canDelete(item) && <button type="button" aria-label={`Excluir movimentação ${item.titulo}`} onClick={() => setPendingDelete(item)} className="grid size-10 place-items-center rounded-control border border-border-default text-text-muted hover:border-danger/30 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30"><Trash2 size={15} /></button>}</span>
    </motion.div>)}</AnimatePresence>{!items.length && <p role="status" className="border-t border-dashed border-border-default p-10 text-center text-sm text-text-muted">Nenhuma movimentação corresponde aos filtros.</p>}</div></div>
    {pendingDelete && <div role="alertdialog" aria-modal="true" aria-labelledby="movement-delete-title" aria-describedby="movement-delete-description" tabIndex={-1} onKeyDown={(event) => { if (event.key === "Escape") setPendingDelete(null); }} className="fixed inset-0 z-[var(--z-modal)] grid place-items-center bg-slate-950/25 p-4"><div className="w-full max-w-sm rounded-card border border-border-default bg-surface-card p-5 shadow-lg"><h2 id="movement-delete-title" className="text-base font-semibold">Excluir movimentação?</h2><p id="movement-delete-description" className="mt-2 text-sm leading-6 text-text-muted">A movimentação manual “{pendingDelete.titulo}” será removida do livro-caixa.</p><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setPendingDelete(null)} className="min-h-11 rounded-control border border-border-default px-4 text-sm font-semibold text-text-secondary">Cancelar</button><button type="button" onClick={() => { onDelete(pendingDelete); setPendingDelete(null); }} className="min-h-11 rounded-control bg-danger px-4 text-sm font-semibold text-white">Confirmar exclusão</button></div></div></div>}
  </>;
}

function PendingList({ items, hasActiveFilters, onClearFilters, onEdit, canEditItem, onReceive, canReceiveItem }: { items: PendenciaDemo[]; hasActiveFilters: boolean; onClearFilters: () => void; onEdit: (item: PendenciaDemo) => void; canEditItem: (item: PendenciaDemo) => boolean; onReceive: (item: PendenciaDemo) => void; canReceiveItem: (item: PendenciaDemo) => boolean }) {
  const [historicoAberto, setHistoricoAberto] = useState<Record<string, boolean>>({});
  const reduceMotion = useReducedMotion();
  if (!items.length) return <div className="rounded-card border border-dashed border-border-default bg-surface-card p-10 text-center"><span className={`mx-auto grid size-11 place-items-center rounded-full ${hasActiveFilters ? "bg-surface-inset text-text-muted" : "bg-positive-bg text-positive"}`}>{hasActiveFilters ? <Search size={17} /> : <Check size={18} />}</span><p className="mt-3 text-sm font-semibold">{hasActiveFilters ? "Nenhuma pendência corresponde aos filtros" : "Fila em dia"}</p><p className="mt-1 text-xs text-text-muted">{hasActiveFilters ? "Remova um filtro ou limpe a seleção para ver outras pendências." : "Não há recebíveis em aberto no momento."}</p>{hasActiveFilters && <button type="button" onClick={onClearFilters} className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-control px-3 text-xs font-semibold text-accent hover:bg-accent-soft-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"><X size={14} />Limpar filtros</button>}</div>;
  return <div className={`${panel} overflow-hidden`}><div className="divide-y divide-border-subtle">{items.map((item, index) => {
    const saldo = Math.max(0, item.total - item.pago);
    const vencida = pendenciaVencida(item);
    const dias = diasAteVencimento(item);
    const proxima = !vencida && dias !== null && dias <= 7;
    return <motion.article layout key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_MICRO, delay: Math.min(index * .03, .18) }} className={`border-l-[3px] p-4 ${vencida ? "border-l-danger bg-danger-bg/15" : proxima ? "border-l-warning bg-warning-bg/20" : "border-l-transparent"}`}>
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 flex-1 items-start gap-3"><span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-md ${item.tipo === "A receber" ? "bg-accent-soft-bg text-accent" : "bg-surface-inset text-text-secondary"}`}>{item.tipo === "A receber" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.tipo === "A receber" ? "bg-accent-soft-bg text-accent" : "bg-surface-inset text-text-secondary"}`}>{item.tipo}</span>{vencida && <span className="rounded-full bg-danger-bg px-2 py-0.5 text-[10px] font-semibold text-danger">{vencimentoLabel(item)}</span>}{proxima && <span className="rounded-full bg-warning-bg px-2 py-0.5 text-[10px] font-semibold text-warning">{vencimentoLabel(item)}</span>}{item.recorrencia && <span className="rounded-full border border-border-default bg-surface-card px-2 py-0.5 text-[10px] text-text-muted">{item.recorrencia}</span>}</div><p className="mt-1.5 truncate text-sm font-semibold">{item.nome}</p><p className="mt-0.5 break-words text-xs leading-relaxed text-text-muted">{item.origem}</p><p className="mt-1 text-[11px] text-text-faint">{!vencida && !proxima ? vencimentoLabel(item) : `Criada ${dateLabel(item.criadaEm)}`}</p></div></div>
        <div className="w-full text-left sm:w-auto sm:min-w-[115px] sm:text-right"><p className={`text-sm font-semibold tabular-nums ${vencida ? "text-danger" : proxima ? "text-warning" : "text-text-primary"}`}>{money(saldo)}</p><p className="mt-0.5 text-[10px] text-text-muted">de {money(item.total)}</p><p className="mt-0.5 text-[10px] text-text-faint">{item.pago > 0 ? `Pago ${money(item.pago)}` : "Sem pagamento"}</p></div>
      </div>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-2 border-t border-border-subtle pt-3"><div className="min-w-0 flex-1">{item.pagamentos?.length ? <div>
        <button type="button" aria-expanded={Boolean(historicoAberto[item.id])} onClick={() => setHistoricoAberto((current) => ({ ...current, [item.id]: !current[item.id] }))} className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-text-secondary underline-offset-2 hover:text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">Histórico de pagamentos · {item.pagamentos.length}<motion.span animate={{ rotate: historicoAberto[item.id] ? 180 : 0 }} transition={SPRING_MICRO}><ChevronDown size={13} /></motion.span></button>
        <AnimatePresence initial={false}>{historicoAberto[item.id] && <motion.ul initial={reduceMotion ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={reduceMotion ? undefined : { opacity: 0, height: 0 }} transition={reduceMotion ? { duration: 0 } : SPRING_MICRO} className="mt-1 overflow-hidden divide-y divide-border-subtle rounded-control border border-border-default bg-surface-card px-3">
          {item.pagamentos.map((pagamento, pagamentoIndex) => <li key={`${pagamento.meio}-${pagamento.ocorridoEm}-${pagamentoIndex}`} className="flex items-center gap-2 py-2 text-xs"><PaymentMethodMark meio={pagamento.meio} className="size-3.5 shrink-0 text-accent-soft-fg" /><span className="min-w-0 flex-1 text-text-secondary">{pagamento.meio} · {dateLabel(pagamento.ocorridoEm)}</span><strong className="shrink-0 tabular-nums text-text-primary">{money(pagamento.valor)}</strong></li>)}
        </motion.ul>}</AnimatePresence>
      </div> : <p className="inline-flex items-center gap-1.5 py-2 text-[11px] text-text-muted"><span aria-hidden="true" className="size-1.5 rounded-full bg-border-default" />Sem pagamentos registrados · saldo em aberto</p>}</div><div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto"><button type="button" onClick={() => onReceive(item)} className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-control border border-accent/30 bg-accent-soft-bg px-3 text-xs font-semibold text-accent transition-colors hover:border-accent/50 sm:flex-none">{canReceiveItem(item) ? "Registrar recebimento" : "Ver recebimentos"}</button><button type="button" onClick={() => onEdit(item)} className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-control border border-border-default bg-surface-card px-3 text-xs font-semibold text-text-secondary transition-colors hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 sm:flex-none"><Pencil size={13} />{canEditItem(item) ? "Editar pendência" : "Ver detalhes"}</button></div></div>
    </motion.article>;
  })}</div></div>;
}

export function VendasPreview({ embutido = false, onAbrirVendasAntigas }: { embutido?: boolean; onAbrirVendasAntigas?: () => void } = {}) {
  const [aba, setAba] = useState<AbaVendasPreview>("Visão geral");
  const [periodo, setPeriodo] = useState<PeriodoVendasPreview>("30 dias");
  const [vendasOriginais, setVendasOriginais] = useState<Venda[]>([]);
  const [caixaOriginal, setCaixaOriginal] = useState<CaixaEntry[]>([]);
  const [recebimentosFiado, setRecebimentosFiado] = useState<FiadoRecebimento[]>([]);
  const [pendenciasCaixa, setPendenciasCaixa] = useState<CaixaPendencia[]>([]);
  const [recebimentosPendencia, setRecebimentosPendencia] = useState<CaixaPendenciaRecebimento[]>([]);
  const [statusVendas, setStatusVendas] = useState<DataStatus>("carregando");
  const [statusCaixa, setStatusCaixa] = useState<DataStatus>("carregando");
  const [erroVendas, setErroVendas] = useState<string | null>(null);
  const [erroCaixa, setErroCaixa] = useState<string | null>(null);
  const [novaVendaAberta, setNovaVendaAberta] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [busca, setBusca] = useState("");
  const [filtroSituacaoVenda, setFiltroSituacaoVenda] = useState("Todas");
  const [canaisVendaSelecionados, setCanaisVendaSelecionados] = useState<CanalVendaDemo[]>([]);
  const [meiosVendaSelecionados, setMeiosVendaSelecionados] = useState<MeioPagamentoDemo[]>([]);
  const [periodoVenda, setPeriodoVenda] = useState("Todos");
  const [clienteVenda, setClienteVenda] = useState("");
  const [produtoVenda, setProdutoVenda] = useState("");
  const [filtroMovimento, setFiltroMovimento] = useState("Todos");
  const [saleDetail, setSaleDetail] = useState<SaleViewModel | null>(null);
  const [pendingEdit, setPendingEdit] = useState<PendenciaDemo | null>(null);
  const [pendingReceivable, setPendingReceivable] = useState<PendenciaDemo | null>(null);
  const [movementDrawer, setMovementDrawer] = useState<CaixaTipo | null>(null);
  const [pendingCreateOpen, setPendingCreateOpen] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [periodoMovimento, setPeriodoMovimento] = useState<PeriodoMovimento>("todos");
  const rootRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let ativo = true;
    const podeVerVendas = podeAtual("vendas.ver");
    const podeVerCaixa = podeAtual("caixa.ver");
    if (!podeVerVendas) setStatusVendas("restrito");
    if (!podeVerCaixa) setStatusCaixa("restrito");

    async function carregar<T>(request: Promise<{ success: boolean; data: T; error?: string }>) {
      const result = await request;
      if (!result.success || result.data == null) throw new Error(result.error || "Falha ao consultar dados.");
      return result.data;
    }

    const requests: Promise<unknown>[] = [];
    if (podeVerVendas) requests.push(carregar(vendasApi.listar()).then((data) => { if (ativo) { setVendasOriginais(data as Venda[]); setErroVendas(null); setStatusVendas("pronto"); } }).catch((error: unknown) => { if (ativo) { setErroVendas(error instanceof Error ? error.message : "Falha ao consultar vendas."); setStatusVendas("erro"); } }));
    if (podeVerCaixa) requests.push(Promise.all([
      carregar(caixaApi.listar()),
      carregar(fiadoApi.listarRecebimentos()),
      carregar(caixaPendenciasApi.listar()),
      carregar(caixaPendenciasApi.listarRecebimentos()),
    ]).then(([caixa, fiado, pendencias, recebimentos]) => {
      if (!ativo) return;
      setCaixaOriginal(caixa as CaixaEntry[]);
      setRecebimentosFiado(fiado as FiadoRecebimento[]);
      setPendenciasCaixa(pendencias as CaixaPendencia[]);
      setRecebimentosPendencia(recebimentos as CaixaPendenciaRecebimento[]);
      setErroCaixa(null);
      setStatusCaixa("pronto");
    }).catch((error: unknown) => { if (ativo) { setErroCaixa(error instanceof Error ? error.message : "Falha ao consultar o Caixa."); setStatusCaixa("erro"); } }));

    return () => { ativo = false; void requests; };
  }, [reloadKey]);

  useEffect(() => {
    if (reduceMotion || !rootRef.current) return;
    const nodes = rootRef.current.querySelectorAll<HTMLElement>("[data-preview-reveal]");
    const animation = animate(nodes, { opacity: [0, 1], translateY: [9, 0], delay: stagger(55), duration: 470, ease: "out(3)" });
    return () => { animation.pause(); };
  }, [aba, reduceMotion]);

  const vendas = useMemo(() => mapearVendas(vendasOriginais, caixaOriginal, recebimentosFiado, statusCaixa === "pronto"), [caixaOriginal, recebimentosFiado, statusCaixa, vendasOriginais]);
  const movimentos = useMemo(() => mapearMovimentos(caixaOriginal, recebimentosFiado, recebimentosPendencia), [caixaOriginal, recebimentosFiado, recebimentosPendencia]);
  const pendencias = useMemo(() => statusCaixa === "pronto" ? mapearPendencias(vendasOriginais, recebimentosFiado, pendenciasCaixa, recebimentosPendencia) : [], [pendenciasCaixa, recebimentosFiado, recebimentosPendencia, statusCaixa, vendasOriginais]);
  const intervaloResumo = useMemo(() => intervaloDoResumo(periodo), [periodo]);
  const vendasDoPeriodo = useMemo(() => {
    return vendas.filter((sale) => parseDataLocal(sale.ocorridoEm) >= intervaloResumo.inicio && parseDataLocal(sale.ocorridoEm) <= intervaloResumo.agora);
  }, [intervaloResumo, vendas]);
  const movimentosDoPeriodo = useMemo(() => movimentos.filter((item) => {
    const data = parseDataLocal(item.ocorridoEm);
    return data >= intervaloResumo.inicio && data <= intervaloResumo.agora;
  }), [intervaloResumo, movimentos]);
  const overview = useMemo(() => buildSalesOverview({ sales: vendas, movements: movimentos, pendings: pendencias, start: intervaloResumo.inicio, end: intervaloResumo.agora, financialAvailable: statusCaixa === "pronto" }), [intervaloResumo, movimentos, pendencias, statusCaixa, vendas]);

  const vendaFiltradas = useMemo(() => vendas.filter((sale) => {
    const texto = `${sale.id} ${sale.cliente} ${sale.item} ${sale.unidade}`.toLocaleLowerCase();
    const hoje = new Date();
    const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const dataVenda = parseDataLocal(sale.ocorridoEm);
    const dias = Math.floor((inicioHoje.getTime() - new Date(dataVenda.getFullYear(), dataVenda.getMonth(), dataVenda.getDate()).getTime()) / umDia);
    const atendeStatus = filtroSituacaoVenda === "Todas" || sale.reconciliation.kind === "settled";
    const atendePeriodo = periodoVenda === "Todos" || (periodoVenda === "Hoje" ? dias === 0 : periodoVenda === "30 dias" ? dias >= 0 && dias <= 29 : dataVenda.getMonth() === hoje.getMonth() && dataVenda.getFullYear() === hoje.getFullYear());
    const atendeCanal = canaisVendaSelecionados.length === 0 || canaisVendaSelecionados.includes(sale.canal);
    const atendePagamento = meiosVendaSelecionados.length === 0 || sale.pagamentos.some((pagamento) => meiosVendaSelecionados.includes(pagamento.meio));
    return texto.includes(busca.toLocaleLowerCase()) && sale.cliente.toLocaleLowerCase().includes(clienteVenda.toLocaleLowerCase()) && sale.item.toLocaleLowerCase().includes(produtoVenda.toLocaleLowerCase()) && atendeStatus && atendePeriodo && atendeCanal && atendePagamento;
  }), [busca, canaisVendaSelecionados, clienteVenda, filtroSituacaoVenda, meiosVendaSelecionados, periodoVenda, produtoVenda, vendas]);

  const filtrosVendaAtivos = useMemo(() => {
    const filtros: Array<{ id: string; label: string; clear: () => void }> = [];
    if (busca) filtros.push({ id: "busca", label: `Busca: ${busca}`, clear: () => setBusca("") });
    if (filtroSituacaoVenda !== "Todas") filtros.push({ id: "situacao", label: "Situação: pagas", clear: () => setFiltroSituacaoVenda("Todas") });
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
  }

  const movimentosFiltrados = useMemo(() => movimentos.filter((item) => {
    const texto = `${item.titulo} ${item.detalhe} ${item.metodo} ${item.origem}`.toLocaleLowerCase();
    const atendeTipo = filtroMovimento === "Todos" || item.tipo === (filtroMovimento === "Entradas" ? "entrada" : "saída");
    return atendeTipo && texto.includes(busca.toLocaleLowerCase());
  }).sort((a, b) => parseDataLocal(b.ocorridoEm).getTime() - parseDataLocal(a.ocorridoEm).getTime()), [busca, filtroMovimento, movimentos]);
  const movimentosVisiveis = useMemo(() => filtrarMovimentosPorPeriodo(movimentosFiltrados, periodoMovimento), [movimentosFiltrados, periodoMovimento]);

  const pendenciasFiltradas = useMemo(() => pendencias.filter((item) => {
    const texto = `${item.nome} ${item.origem} ${item.tipo}`.toLocaleLowerCase();
    return item.pago < item.total && texto.includes(busca.toLocaleLowerCase());
  }).sort((a, b) => Number(pendenciaVencida(b)) - Number(pendenciaVencida(a)) || parseDataLocal(a.venceEm ?? a.criadaEm).getTime() - parseDataLocal(b.venceEm ?? b.criadaEm).getTime()), [busca, pendencias]);

  const totalVendas = overview.period.grossSales;
  const entradasDoPeriodo = movimentosDoPeriodo.filter((item) => item.tipo === "entrada");
  const totalEntradas = statusCaixa === "pronto" ? overview.period.cashIn : null;
  const totalReceber = statusCaixa === "pronto" ? overview.current.receivable : null;
  const totalVencido = statusCaixa === "pronto" ? overview.current.overdue : null;
  const saldoCaixa = statusCaixa === "pronto" ? overview.period.netResult : null;
  const contadorPendencias = pendencias.filter((item) => item.pago < item.total).length;
  const meiosDisponiveis = Array.from(new Set(vendas.flatMap((sale) => sale.pagamentos.map((pagamento) => pagamento.meio)))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const canaisDisponiveis = Array.from(new Set(vendas.map((sale) => sale.canal))).sort((a, b) => a.localeCompare(b, "pt-BR"));

  function detalharVenda(sale: SaleViewModel) {
    setSaleDetail(sale);
  }

  async function excluirMovimentacao(item: MovimentoDemo) {
    setMutationError(null);
    try {
      const result = await caixaApi.excluir(item.id);
      if (!result.success) throw new Error(result.error || 'Não foi possível excluir a movimentação.');
      setReloadKey((value) => value + 1);
    } catch (cause) {
      setMutationError(cause instanceof Error ? cause.message : 'Não foi possível excluir a movimentação.');
    }
  }

  return <div ref={rootRef} style={previewTokens} data-project="rk-sucatas-new" className="min-h-screen min-w-0 bg-surface-page font-[Geist,Inter,ui-sans-serif,system-ui] text-text-primary [&_button]:cursor-pointer">
    <style>{`@keyframes meli-sale-border { 0%, 100% { box-shadow: 0 0 0 0 rgba(231, 202, 0, 0); } 45% { box-shadow: 0 0 0 2px rgba(231, 202, 0, .2); } } .meli-sale-row, .meli-sale-highlight { transition: border-color .18s ease, box-shadow .18s ease; } @media (prefers-reduced-motion: no-preference) { .meli-sale-row:hover, .meli-sale-row:focus-visible, .meli-sale-highlight { animation: meli-sale-border .55s ease-out; } } @media (prefers-reduced-motion: reduce) { .meli-sale-row, .meli-sale-highlight { transition: none; animation: none; } }`}</style>
    <header className="sticky top-0 z-40 border-b border-border-default bg-surface-card/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-3 px-3 py-2.5 sm:px-6">
        <div className="grid size-8 shrink-0 place-items-center rounded-md bg-accent text-[10px] font-black text-white">RK</div>
        <div className="min-w-0 flex-1 sm:max-w-none"><p className="truncate text-sm font-semibold tracking-tight">RK Sucatas</p><p className="truncate font-mono text-[9px] uppercase tracking-[0.12em] text-text-faint">Vendas e financeiro</p></div>
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          {embutido && podeAtual("vendas.criar") && <button type="button" onClick={() => setNovaVendaAberta(true)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-control bg-accent px-3 text-xs font-semibold text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:flex-none"><Plus size={15} />Nova venda</button>}
          <button type="button" onClick={() => { setAba("Pendências"); setBusca(""); }} aria-label={statusCaixa === "pronto" ? `Abrir pendências (${contadorPendencias})` : "Abrir pendências"} className="relative grid size-11 shrink-0 place-items-center rounded-control border border-border-default text-text-muted transition hover:bg-surface-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"><BellRing size={16} />{statusCaixa === "pronto" && contadorPendencias > 0 && <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-warning px-1 font-mono text-[9px] text-white">{contadorPendencias}</span>}</button>
        </div>
      </div>
    </header>

    <main className="mx-auto w-full max-w-[1440px] px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:py-8 lg:py-10">
      <div className="flex min-w-0 flex-col gap-4 border-b border-border-default lg:flex-row lg:items-end lg:justify-between">
        <div className="pb-4"><p className={label}>Operação comercial · vendas, caixa e recebimentos</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Vendas</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">Consulte e atualize a operação em um só lugar.</p></div>
        <div className="w-full sm:w-auto"><SegmentTabs value={aba} onValueChange={(value) => { setAba(value as AbaVendasPreview); setBusca(""); }} className="w-full sm:w-auto"><SegmentTabsList aria-label="Visões de vendas" className="grid w-full grid-cols-2 gap-1 bg-slate-50 p-1 sm:inline-flex sm:w-fit sm:grid-cols-none sm:gap-0.5">{abas.map((tab, index) => <SegmentTabsTrigger key={tab} value={tab} id={`vendas-tab-${index}`} aria-controls="vendas-preview-panel" className="min-h-11 min-w-0 w-full px-2 py-2 text-center text-xs leading-tight sm:w-auto sm:whitespace-nowrap sm:px-3 sm:text-sm">{tab}{tab === "Pendências" && <span className="ml-1 text-[11px] text-slate-400">{contadorPendencias}</span>}</SegmentTabsTrigger>)}</SegmentTabsList></SegmentTabs></div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {aba === "Visão geral" && <div className="w-36"><Select ariaLabel="Período do resumo" value={periodo} onChange={(value) => setPeriodo(value as PeriodoVendasPreview)} options={["Hoje", "30 dias", "Este mês"].map((value) => ({ value, label: value }))} size="lg" /></div>}
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.section key={aba} id="vendas-preview-panel" role="tabpanel" aria-labelledby={`vendas-tab-${abas.indexOf(aba)}`} tabIndex={0} initial={reduceMotion ? false : { opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -4 }} transition={{ duration: reduceMotion ? 0 : .18 }} className="mt-6 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">
          {aba === "Visão geral" && (statusVendas !== "pronto" ? <DataNotice status={statusVendas} area="as vendas" detail={erroVendas ?? undefined} /> : <Overview period={periodo} periodDays={intervaloResumo.dias} sales={totalVendas} salesCount={vendasDoPeriodo.length} cashIn={totalEntradas} cashInCount={statusCaixa === "pronto" ? entradasDoPeriodo.length : null} balance={saldoCaixa} receivable={totalReceber} overdue={totalVencido} pendencies={pendencias} salesRows={vendas} movementRows={movimentosDoPeriodo} financialAvailable={statusCaixa === "pronto"} onOpenTab={setAba} />)}

          {aba === "Vendas" && (statusVendas !== "pronto" ? <DataNotice status={statusVendas} area="as vendas" detail={erroVendas ?? undefined} /> : <div className="space-y-4">
            <SectionTitle eyebrow="Registro e consulta" title="Vendas recentes" aside={<span className="font-mono text-[10px] uppercase tracking-wide text-text-faint">{vendaFiltradas.length} registros</span>} />
            <div className="space-y-2.5">
              <label className="relative block min-w-0"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" size={15} /><input aria-label="Buscar vendas" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar cliente, peça ou código" className={`${inputClass} pl-9`} /></label>
              <div className="flex flex-wrap items-center gap-2">
                {statusCaixa === "pronto" && <div role="group" aria-label="Filtrar vendas por situação" className="inline-flex min-h-11 items-center gap-0.5 rounded-control border border-border-default bg-surface-inset p-1">
                  {["Todas", "Pagas"].map((status) => <button key={status} type="button" aria-pressed={filtroSituacaoVenda === status} onClick={() => setFiltroSituacaoVenda(status)} className={`min-h-9 rounded-[4px] px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 sm:px-3 ${filtroSituacaoVenda === status ? "bg-surface-card text-accent shadow-sm" : "text-text-muted hover:text-text-primary"}`}>{status}</button>)}
                </div>}
                <MultiFilter label="Canal" selected={canaisVendaSelecionados} options={canaisDisponiveis} onChange={(values) => setCanaisVendaSelecionados(values as CanalVendaDemo[])} />
                <MultiFilter label="Pagamento" selected={meiosVendaSelecionados} options={meiosDisponiveis} onChange={(values) => setMeiosVendaSelecionados(values as MeioPagamentoDemo[])} />
                <PopoverRoot variant="subtle">
                  <PopoverTrigger className={`${control} h-11 md:h-11 normal-case tracking-normal bg-surface-card`}><SlidersHorizontal size={14} />Mais filtros{(periodoVenda !== "Todos" || clienteVenda || produtoVenda) && <span className="grid min-w-5 place-items-center rounded-full bg-accent-soft-bg px-1.5 py-0.5 font-mono text-[10px] text-accent">{Number(periodoVenda !== "Todos") + Number(Boolean(clienteVenda)) + Number(Boolean(produtoVenda))}</span>}<ChevronDown size={14} className="text-text-faint" /></PopoverTrigger>
                  <PopoverContent className="left-auto right-0 grid w-[min(20rem,calc(100vw-2rem))] gap-3 p-4">
                    <Select label="Período" value={periodoVenda} onChange={setPeriodoVenda} options={["Todos", "Hoje", "30 dias", "Este mês"].map((value) => ({ value, label: value }))} size="lg" />
                    <label className="text-xs font-semibold text-text-secondary">Cliente<input value={clienteVenda} onChange={(event) => setClienteVenda(event.target.value)} placeholder="Nome do cliente" className={`${inputClass} mt-1.5`} /></label>
                    <label className="text-xs font-semibold text-text-secondary">Peça<input value={produtoVenda} onChange={(event) => setProdutoVenda(event.target.value)} placeholder="Nome da peça" className={`${inputClass} mt-1.5`} /></label>
                  </PopoverContent>
                </PopoverRoot>
              </div>
              {filtrosVendaAtivos.length > 0 && <div className="flex flex-wrap items-center gap-1.5" aria-label="Filtros ativos">{filtrosVendaAtivos.map((filtro) => <FilterChip key={filtro.id} onRemove={filtro.clear}>{filtro.label}</FilterChip>)}<button type="button" onClick={limparFiltrosVenda} className="min-h-8 px-2 text-[11px] font-semibold text-text-muted underline-offset-2 hover:text-text-primary hover:underline">Limpar filtros</button></div>}
            </div>
            <SalesList sales={vendaFiltradas} onDetail={detalharVenda} onClearFilters={limparFiltrosVenda} hasActiveFilters={filtrosVendaAtivos.length > 0} />
          </div>)}

          {aba === "Movimentações" && (statusCaixa !== "pronto" ? <DataNotice status={statusCaixa} area="as movimentações do Caixa" detail={erroCaixa ?? undefined} /> : <div className="space-y-4">
            <SectionTitle eyebrow="Histórico cronológico" title="Entradas e saídas" aside={podeAtual("caixa.criar") ? <div className="flex w-full flex-wrap gap-2 sm:w-auto"><button type="button" onClick={() => { setMutationError(null); setMovementDrawer("entrada"); }} className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-control border border-positive/30 px-3 text-xs font-semibold text-positive hover:bg-positive-bg sm:flex-none"><Plus size={14} />Nova entrada</button><button type="button" onClick={() => { setMutationError(null); setMovementDrawer("saida"); }} className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-control border border-negative/30 px-3 text-xs font-semibold text-negative hover:bg-negative-bg sm:flex-none"><Plus size={14} />Nova saída</button></div> : undefined} />
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center"><label className="relative block min-w-0 flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" size={15} /><input aria-label="Buscar movimentações" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar origem, descrição ou pagamento" className={`${inputClass} pl-9`} /></label><div className="w-full sm:w-48"><Select ariaLabel="Filtrar movimentações" value={filtroMovimento} onChange={setFiltroMovimento} options={["Todos", "Entradas", "Saídas"].map((value) => ({ value, label: value }))} size="lg" /></div><SegmentTabs value={periodoMovimento} onValueChange={(value) => setPeriodoMovimento(value as PeriodoMovimento)} className="w-full sm:w-auto"><SegmentTabsList aria-label="Período das movimentações" className="w-full max-w-full shrink-0 bg-surface-inset sm:w-auto"><SegmentTabsTrigger value="todos" className="min-h-9 flex-1 whitespace-nowrap px-3 text-xs sm:flex-none">Todos os períodos</SegmentTabsTrigger><SegmentTabsTrigger value="trinta-dias" className="min-h-9 flex-1 whitespace-nowrap px-3 text-xs sm:flex-none">30 dias</SegmentTabsTrigger></SegmentTabsList></SegmentTabs></div>
            <p className="text-xs leading-5 text-text-muted">Lançamentos efetivos do livro-caixa, incluindo entradas e saídas registradas.</p>
            {mutationError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-danger/20 bg-danger-bg px-3 py-2.5 text-xs text-danger"><span>{mutationError}</span><button type="button" onClick={() => setMutationError(null)} className="font-semibold underline underline-offset-2">Fechar</button></div>}
            <MovementsList items={movimentosVisiveis} canDelete={(item) => item.podeExcluir === true && podeAtual("caixa.excluir")} onDelete={(item) => { void excluirMovimentacao(item); }} />
            <div className={`${panel} flex flex-wrap items-center justify-between gap-2 p-4 text-xs`}><span className="text-text-muted">Saldo líquido dos lançamentos filtrados</span><strong className="text-positive tabular-nums">{money(movimentosVisiveis.reduce((sum, item) => sum + (item.tipo === "entrada" ? item.valor : -item.valor), 0))}</strong></div>
          </div>)}

          {aba === "Pendências" && (statusCaixa !== "pronto" ? <DataNotice status={statusCaixa} area="as pendências e recebimentos" detail={erroCaixa ?? undefined} /> : <div className="space-y-4">
            <SectionTitle eyebrow="Recebíveis em aberto" title="Pendências" aside={podeAtual("caixa.gerenciar_pendencias") ? <button type="button" onClick={() => setPendingCreateOpen(true)} className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-control bg-accent px-3 text-xs font-semibold text-white hover:bg-accent-hover sm:w-auto"><Plus size={14} />Nova pendência</button> : undefined} />
            <div className="grid gap-3 sm:grid-cols-2"><div className={`${panel} p-3.5 sm:p-4`}><p className={label}>A receber</p><p className="mt-2 text-xl font-semibold tabular-nums">{money(totalReceber ?? 0)}</p><p className="mt-1 text-[11px] text-text-muted">{contadorPendencias} {contadorPendencias === 1 ? "recebível aberto" : "recebíveis abertos"}</p></div><div className={`${panel} p-3.5 sm:p-4`}><p className={label}>Em atraso</p><p className="mt-2 text-xl font-semibold tabular-nums text-danger">{money(totalVencido ?? 0)}</p><p className="mt-1 text-[11px] text-text-muted">Em aberto há 30 dias ou mais</p></div></div>
            <label className="relative block min-w-0"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" size={15} /><input aria-label="Buscar pendências" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar cliente ou origem" className={`${inputClass} pl-9`} /></label>
            <PendingList items={pendenciasFiltradas} hasActiveFilters={Boolean(busca)} onClearFilters={limparFiltrosPendencia} onEdit={setPendingEdit} canEditItem={(item) => item.source.kind === "caixa" ? podeAtual("caixa.gerenciar_pendencias") : podeAtual("vendas.editar")} onReceive={setPendingReceivable} canReceiveItem={(item) => item.source.kind === "caixa" ? podeAtual("caixa.gerenciar_pendencias") : podeAtual("caixa.receber_fiado")} />
            <p className="rounded-control border border-border-default bg-surface-inset px-4 py-3 text-xs leading-5 text-text-muted">Recebíveis em fiado são calculados a partir das vendas e dos recebimentos vinculados. A classificação como atrasado segue a regra atual do Caixa: 30 dias em aberto.</p>
          </div>)}
        </motion.section>
      </AnimatePresence>

    {!embutido && <div className="mt-6 rounded-control border border-border-default bg-surface-inset px-4 py-3 text-xs leading-5 text-text-muted">Vendas, movimentações e recebíveis aparecem nesta tela em um único fluxo.</div>}
    </main>

    <SaleDetailDrawer sale={saleDetail} onClose={() => setSaleDetail(null)} />
    <PendingEditDrawer pending={pendingEdit} canEdit={pendingEdit?.source.kind === "caixa" ? podeAtual("caixa.gerenciar_pendencias") : podeAtual("vendas.editar")} onClose={() => setPendingEdit(null)} onSaved={() => setReloadKey((value) => value + 1)} />
    <PendingReceivableDrawer pending={pendingReceivable} canReceive={pendingReceivable?.source.kind === "caixa" ? podeAtual("caixa.gerenciar_pendencias") : podeAtual("caixa.receber_fiado")} onClose={() => setPendingReceivable(null)} onSaved={() => { setPendingReceivable(null); setReloadKey((value) => value + 1); }} />
    <MovementActionDrawer isOpen={movementDrawer !== null} initialTipo={movementDrawer ?? 'entrada'} onClose={() => setMovementDrawer(null)} onSaved={() => { setMovementDrawer(null); setReloadKey((value) => value + 1); }} />
    <PendingCreateDrawer isOpen={pendingCreateOpen} onClose={() => setPendingCreateOpen(false)} onSaved={() => { setPendingCreateOpen(false); setReloadKey((value) => value + 1); }} />
    {embutido && novaVendaAberta && <Suspense fallback={null}><NovaVendaDrawer isOpen onClose={() => setNovaVendaAberta(false)} onSaved={() => setReloadKey((value) => value + 1)} /></Suspense>}
  </div>;
}
