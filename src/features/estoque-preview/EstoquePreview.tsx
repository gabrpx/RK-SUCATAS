import {
  Archive,
  ClipboardCheck,
  ExternalLink,
  LayoutGrid,
  List,
  Loader2,
  MapPin,
  MoreHorizontal,
  PackagePlus,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import { DotMatrix } from "dot-anime-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject, ReactNode, UIEvent } from "react";
import { Area, AreaChart } from "@/src/components/charts/area-chart";
import { Grid } from "@/src/components/charts/grid";
import { XAxis } from "@/src/components/charts/x-axis";
import { Button } from "@/src/components/ui/button";
import { Tabs as SegmentTabs, TabsList as SegmentTabsList, TabsTrigger as SegmentTabsTrigger } from "../tarefas-preview/PreviewTabs";
import { AnimatePresence, motion } from "motion/react";
import { categoriasApi, formasPagamentoApi } from "../../lib/catalogApi";
import { usePermissao } from "../../hooks/usePermissao";
import { estoqueApi } from "../estoque/api";
import { clientesApi } from "../clientes/api";
import type { Cliente } from "../clientes/types";
import { adaptarEstoqueReal } from "./realInventoryAdapter";
import { salvarUnidadeOperacional } from "./persistInventory";
import { InventoryComposer } from "./InventoryComposer";
import { InventoryDialog, InventoryTokensContext, lightInventoryTokens } from "./InventoryDrawer";
import { InventoryConferencia, pecasComFichasSobrando } from "./InventoryConferencia";
import { InventoryUnitDrawer, type HistoricoCarregado } from "./InventoryUnitDrawer";
import { InventoryPieceSummaryDrawer } from "./InventoryPieceSummaryDrawer";
import { InventoryMap } from "./InventoryMap";
import { ImageZoom } from "../../components/ui/image-zoom";
import { organizacaoApi, RECURSOS_DEMONSTRACAO, type BaixaPendente, type RecursosOrganizacao, type UnidadeFichaPayload } from "./organizacaoApi";
import {
  adicionarUnidade,
  alternarCategoriaDaSecao,
  arquivarUnidade,
  buscarPecas,
  criarEstoqueDemo,
  diasRestantesReserva,
  editarUnidade,
  filtrarEstoqueBaixo,
  getMetricas,
  historicoDemonstracao,
  liberarReservaUnidade,
  ordenarUnidadesPorCondicao,
  reservarUnidade,
  restaurarUnidade,
  type EstoquePreviewState,
  type ReservaUnidadeInput,
  type PecaEstoque,
  type UnidadeEstoque,
} from "./inventoryPreviewModel";

type Aba = "atendimento" | "organizar" | "mapa" | "arquivados";
type Visualizacao = "cards" | "lista";

const buttonBase = "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-control px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50";
const botaoSecundario = `${buttonBase} border border-border-default bg-surface-card text-text-secondary hover:border-accent/40 hover:text-accent`;

/** Mesmo rótulo de seção da tela Tarefas (tarefas-preview/TasksPreview.tsx). */
function SurfaceLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint ${className}`}>{children}</p>;
}

function moeda(valor: number | null) {
  return valor === null ? "Preço a definir" : valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function estadoLabel(unidade: UnidadeEstoque) {
  if (unidade.vendidaEm) return "Vendida";
  if (unidade.estado === "arquivada") return "Arquivada";
  if (unidade.estado === "reservada") return `Reservada · ${diasRestantesReserva(unidade.reservadaAte ?? "")} dias restantes`;
  if (unidade.estado === "organizar" || !unidade.endereco) return "Organizar";
  return "Disponível";
}

// Cor com significado fixo nesta tela: positive = pode vender, accent =
// reservada, warning = pendência de organização, neutro = fora do ativo.
function estadoClass(unidade: UnidadeEstoque) {
  if (unidade.estado === "arquivada" || unidade.vendidaEm) return "bg-surface-inset text-text-secondary";
  if (unidade.estado === "reservada") return "bg-accent-soft-bg text-accent-soft-fg";
  if (unidade.estado === "organizar" || !unidade.endereco) return "bg-warning-bg text-warning";
  return "bg-positive-bg text-positive";
}

function podeEditarUnidade(unidade: UnidadeEstoque) {
  return unidade.individualizada !== false && unidade.estado !== "arquivada" && !unidade.vendidaEm;
}

interface AcoesUnidade {
  onOpen: (unidade: UnidadeEstoque) => void;
  onOpenSummary: (pecaId: string) => void;
  onEdit: (unidade: UnidadeEstoque) => void;
  onArchive: (unidade: UnidadeEstoque) => void;
  onAddUnit: (peca: PecaEstoque) => void;
  podeArquivar: boolean;
  podeEditar: boolean;
  podeCriar: boolean;
  /** Abre a conferência (fichas sobrando / vendas sem unidade). */
  onConferir?: () => void;
}

function ActionMenu({ unidade, acoes }: { unidade: UnidadeEstoque; acoes: AcoesUnidade }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fecharComEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setAberto(false); gatilho.current?.focus(); }
    };
    const fecharFora = (event: MouseEvent) => { if (raiz.current && !raiz.current.contains(event.target as Node)) setAberto(false); };
    document.addEventListener("keydown", fecharComEscape);
    document.addEventListener("mousedown", fecharFora);
    return () => { document.removeEventListener("keydown", fecharComEscape); document.removeEventListener("mousedown", fecharFora); };
  }, [aberto]);
  if (unidade.individualizada === false) return <span className="text-[11px] text-text-muted">Sem ficha individual</span>;
  // Vendida/arquivada: a ficha é só consulta, então o menu não oferece edição.
  const editavel = podeEditarUnidade(unidade) && acoes.podeEditar;
  const arquivavel = editavel && acoes.podeArquivar && unidade.estado !== "reservada";
  if (!editavel && !arquivavel) return null;
  return <div ref={raiz} className="relative">
    <button ref={gatilho} type="button" aria-label={`Ações de ${unidade.sku}`} aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto((valor) => !valor)} className="grid size-11 cursor-pointer place-items-center rounded-control text-text-faint transition hover:bg-surface-inset hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"><MoreHorizontal size={18} /></button>
    <AnimatePresence>{aberto && <motion.div role="menu" initial={{ opacity: 0, scale: 0.96, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: -4 }} transition={{ duration: 0.14 }} style={{ transformOrigin: "top right" }} className="absolute right-0 top-12 z-20 min-w-44 rounded-card border border-border-default bg-surface-card p-1 shadow-lg">
      {editavel && <button type="button" role="menuitem" onClick={() => { setAberto(false); acoes.onEdit(unidade); }} className="block min-h-11 w-full cursor-pointer rounded-control px-3 text-left text-sm hover:bg-surface-inset focus-visible:bg-surface-inset focus-visible:outline-none">Editar unidade</button>}
      {arquivavel && <button type="button" role="menuitem" onClick={() => { setAberto(false); acoes.onArchive(unidade); }} className="block min-h-11 w-full cursor-pointer rounded-control px-3 text-left text-sm text-danger hover:bg-danger-bg focus-visible:bg-danger-bg focus-visible:outline-none">Arquivar unidade</button>}
    </motion.div>}</AnimatePresence>
  </div>;
}

function UnitRow({ unidade, acoes }: { unidade: UnidadeEstoque; acoes: AcoesUnidade }) {
  return <div className="relative flex min-h-36 w-[min(19rem,86vw)] shrink-0 snap-start flex-col rounded-control border border-border-default bg-surface-card p-3 shadow-sm transition hover:border-accent/35 hover:shadow-md">
    <div className="flex items-start gap-3">
      <div className="grid aspect-[4/3] w-16 shrink-0 place-items-center overflow-hidden rounded-control border border-dashed border-border-default bg-surface-inset text-center text-[10px] font-semibold text-text-faint">{unidade.fotoUrl ? <ImageZoom src={unidade.fotoUrl} alt={`Foto ${unidade.sku}`} triggerClassName="size-full overflow-hidden rounded-control" className="size-full object-contain" /> : "Sem foto"}</div>
      <button type="button" aria-label={`Ver detalhes de ${unidade.sku}`} onClick={() => acoes.onOpen(unidade)} className="min-w-0 flex-1 cursor-pointer rounded-control text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">
        <p className="text-base font-semibold text-text-primary">{moeda(unidade.preco)}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5"><span className="text-xs font-semibold text-text-secondary">{unidade.sku}</span><span className="rounded-full bg-surface-inset px-2 py-0.5 text-[10px] font-semibold text-text-secondary">Grau {unidade.grau}</span></div>
        <p className="mt-1 truncate text-xs text-text-muted">{unidade.endereco ?? "Sem endereço"} · {unidade.origem ?? "Origem não identificada"}</p>
      </button>
      <ActionMenu unidade={unidade} acoes={acoes} />
    </div>
    <span className={`mt-auto w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${estadoClass(unidade)}`}>{estadoLabel(unidade)}</span>
  </div>;
}

function RupturaAviso({ peca, acoes, compacto = false }: { peca: PecaEstoque; acoes: AcoesUnidade; compacto?: boolean }) {
  return <div className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-control border border-dashed border-negative/40 bg-negative-bg px-4 ${compacto ? "py-2" : "min-h-24 py-3"} text-sm text-text-primary`}>
    <span><strong>0 unidades físicas.</strong> Cadastre ou vincule uma unidade para liberar este item.</span>
    {acoes.podeCriar && <button type="button" onClick={() => acoes.onAddUnit(peca)} aria-label={`Adicionar unidade a ${peca.codigoLegado}`} className={`${botaoSecundario} border-negative/30`}><Plus size={15} />Adicionar unidade</button>}
  </div>;
}

function PieceCard({ resultado, acoes }: { resultado: ReturnType<typeof buscarPecas>[number]; acoes: AcoesUnidade }) {
  const unidadesRef = useRef<HTMLDivElement>(null);
  const [fadeUnidades, setFadeUnidades] = useState({ esquerda: false, direita: false });
  const temMaisUnidades = resultado.unidades.length > 2;
  const unidadesOrdenadas = ordenarUnidadesPorCondicao(resultado.unidades);
  const sobrandoNaPeca = resultado.peca.fichasExcedentes ?? 0;
  const quantidade = Math.max(0, resultado.unidades.length - sobrandoNaPeca);
  const semEstoque = resultado.unidades.length === 0;
  const semFicha = resultado.unidades.filter((unidade) => unidade.individualizada === false).length;
  const sobrando = resultado.peca.fichasExcedentes ?? 0;
  useEffect(() => {
    const faixa = unidadesRef.current;
    if (!faixa) return;
    const atualizar = () => {
      const maximo = faixa.scrollWidth - faixa.clientWidth;
      setFadeUnidades({ esquerda: faixa.scrollLeft > 2, direita: maximo > 2 && faixa.scrollLeft < maximo - 2 });
    };
    // React pode registrar `wheel` como passivo, ignorando preventDefault.
    // O listener nativo converte a roda vertical para o trilho horizontal.
    const rolarHorizontalmente = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      const maximo = faixa.scrollWidth - faixa.clientWidth;
      if (maximo <= 1) return;
      const noInicio = faixa.scrollLeft <= 1;
      const noFim = faixa.scrollLeft >= maximo - 1;
      if ((event.deltaY < 0 && noInicio) || (event.deltaY > 0 && noFim)) return;
      event.preventDefault();
      faixa.scrollLeft += event.deltaY;
    };
    atualizar();
    faixa.addEventListener("wheel", rolarHorizontalmente, { passive: false });
    window.addEventListener("resize", atualizar);
    return () => {
      faixa.removeEventListener("wheel", rolarHorizontalmente);
      window.removeEventListener("resize", atualizar);
    };
  }, [resultado.unidades.length]);
  return <article className={`overflow-hidden rounded-card border bg-surface-card p-4 shadow-sm ${semEstoque ? "border-negative/40" : "border-border-default"}`}>
    <button type="button" aria-label={`Ver resumo de ${resultado.peca.nome} e de todas as suas ${resultado.unidades.length} unidades`} onClick={() => acoes.onOpenSummary(resultado.peca.id)} className="flex w-full cursor-pointer items-start justify-between gap-4 rounded-control text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">
      <span className="min-w-0"><span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">{resultado.categoria.nome} · {resultado.peca.codigoLegado}</span><span className="mt-1 block break-words text-base font-semibold text-text-primary">{resultado.peca.nome}</span><span className="mt-1 block text-xs text-text-muted">{resultado.peca.compatibilidades.join(" · ") || "Moto não informada"}</span><span className="mt-2 block text-[11px] font-semibold text-accent-soft-fg">Ver resumo das unidades</span></span>
      <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${semEstoque ? "bg-negative-bg text-negative" : "bg-surface-inset text-text-secondary"}`}>{semEstoque ? "Sem estoque" : `${quantidade} ${quantidade === 1 ? "unidade" : "unidades"}${semFicha ? ` · ${semFicha} sem ficha` : ""}${sobrandoNaPeca ? ` · ${sobrandoNaPeca} a conferir` : ""}`}</span>
    </button>
    <div className="relative mt-4">
      <div ref={unidadesRef} role="region" aria-label={`Unidades de ${resultado.peca.codigoLegado}`} tabIndex={0} onKeyDown={(event) => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); event.currentTarget.scrollBy({ left: (event.key === "ArrowRight" ? 1 : -1) * event.currentTarget.clientWidth * 0.75, behavior: "smooth" }); } }} onScroll={(event) => {
        const faixa = event.currentTarget;
        const maximo = faixa.scrollWidth - faixa.clientWidth;
        setFadeUnidades({ esquerda: faixa.scrollLeft > 2, direita: maximo > 2 && faixa.scrollLeft < maximo - 2 });
      }} className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-smooth pb-1 pr-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">{semEstoque ? <RupturaAviso peca={resultado.peca} acoes={acoes} /> : unidadesOrdenadas.map((unidade) => <UnitRow key={unidade.id} unidade={unidade} acoes={acoes} />)}</div>
      {temMaisUnidades && fadeUnidades.esquerda && <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-surface-card via-surface-card/85 to-transparent" />}
      {temMaisUnidades && fadeUnidades.direita && <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-surface-card via-surface-card/85 to-transparent" />}
    </div>
    {sobrando > 0 && acoes.onConferir && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-control border border-warning/30 bg-warning-bg px-3 py-2 text-xs text-text-primary"><span><strong>{sobrando === 1 ? "1 ficha sobrando" : `${sobrando} fichas sobrando`}.</strong> Uma venda antiga não disse qual unidade saiu.</span><button type="button" onClick={acoes.onConferir} className={`${botaoSecundario} min-h-9`}><ClipboardCheck size={14} />Conferir</button></div>}
  </article>;
}

function InventoryMetricStrip({ metricas }: { metricas: ReturnType<typeof getMetricas> }) {
  // Mesma faixa de indicadores da tela Tarefas (TurnMetricStrip): cartões
  // brancos, rótulo mono, número grande; no celular a faixa desliza de lado.
  // Localização e disponibilidade são contagens diferentes: reservar tira a
  // unidade da venda, mas não do endereço físico.
  const metrics = [
    { label: "Valor em estoque", value: moeda(metricas.valorEmEstoque), suffix: `${metricas.unidadesComPreco}/${metricas.totalAtivas} com preço`, detail: "unidades ativas, inclusive reservadas", tone: "blue" },
    { label: "Disponíveis", value: String(metricas.disponiveis), suffix: `de ${metricas.totalAtivas} ativas`, detail: [metricas.reservadas ? `${metricas.reservadas} ${metricas.reservadas === 1 ? "reservada" : "reservadas"} com sinal` : null, metricas.fichasExcedentes ? `${metricas.fichasExcedentes} ${metricas.fichasExcedentes === 1 ? "ficha sobrando fora da conta" : "fichas sobrando fora da conta"}` : null, "inclui quantidades legadas sem ficha"].filter(Boolean).join(" · "), tone: "emerald" },
    { label: "Localizadas", value: String(metricas.localizadas), suffix: "com endereço", detail: "reservadas continuam no mesmo lugar", tone: "blue" },
    { label: "Para organizar", value: String(metricas.paraOrganizar), suffix: "na fila", detail: "sem endereço definitivo", tone: "amber" },
  ] as const;
  const tons = {
    blue: { ponto: "bg-accent", texto: "text-text-muted", borda: "border-border-default" },
    emerald: { ponto: "bg-positive", texto: "text-positive", borda: "border-border-default" },
    amber: { ponto: "bg-warning", texto: "text-warning", borda: "border-warning/30" },
  };
  const faixa = useRef<HTMLElement | null>(null);
  const [rolagem, setRolagem] = useState({ rolavel: false, esquerda: false, direita: false });
  const atualizar = useCallback(() => {
    const el = faixa.current;
    if (!el) return;
    const rolavel = el.scrollWidth > el.clientWidth + 1;
    setRolagem({ rolavel, esquerda: rolavel && el.scrollLeft > 4, direita: rolavel && el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    atualizar();
    window.addEventListener("resize", atualizar);
    return () => window.removeEventListener("resize", atualizar);
  }, [atualizar]);
  return <div className="relative">
    <section ref={faixa} onScroll={atualizar} aria-label="Resumo operacional do estoque" className="no-scrollbar snap-x snap-mandatory overflow-x-auto scroll-smooth">
      <div className="grid min-w-[920px] grid-cols-4 gap-3">{metrics.map((metric, indice) => {
        const tom = tons[metric.tone];
        return <motion.div key={metric.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 340, damping: 31, bounce: 0, delay: indice * 0.04 }} className={`min-h-[132px] min-w-0 snap-start rounded-lg border bg-surface-card p-4 shadow-[var(--elevation-1)] ${tom.borda}`}>
          <div className="flex items-center justify-between gap-2"><SurfaceLabel className="truncate">{metric.label}</SurfaceLabel><span className={`size-1.5 shrink-0 rounded-full ${tom.ponto}`} aria-hidden="true" /></div>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1"><p className="text-[28px] font-semibold leading-none tracking-[-0.05em] text-text-primary">{metric.value}</p><span className="font-mono text-[11px] text-text-muted">{metric.suffix}</span></div>
          <p className={`mt-3 text-[11px] leading-snug ${tom.texto}`}><span className={`mr-1 inline-block size-1.5 rounded-full ${tom.ponto}`} aria-hidden="true" />{metric.detail}</p>
        </motion.div>;
      })}</div>
    </section>
    {rolagem.rolavel && <>
      <div aria-hidden="true" className={`pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-surface-page to-transparent transition-opacity duration-200 ${rolagem.esquerda ? "opacity-100" : "opacity-0"}`} />
      <div aria-hidden="true" className={`pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-surface-page to-transparent transition-opacity duration-200 ${rolagem.direita ? "opacity-100" : "opacity-0"}`} />
      <span className="sr-only">Arraste para o lado para ver mais indicadores do estoque.</span>
    </>}
  </div>;
}

function StockRhythmCard({ unidades }: { unidades: UnidadeEstoque[] }) {
  const formatoDia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
  const diaLocal = (data: Date) => {
    const partes = Object.fromEntries(formatoDia.formatToParts(data).map((parte) => [parte.type, parte.value]));
    return `${partes.year}-${partes.month}-${partes.day}`;
  };
  const ritmo = Array.from({ length: 7 }, (_, indice) => {
    const date = diaLocal(new Date(Date.now() - (6 - indice) * 86400000));
    return { date, organizadas: unidades.filter((unidade) => unidade.organizadaEm && diaLocal(new Date(unidade.organizadaEm)) === date).length };
  });
  const total = ritmo.reduce((soma, item) => soma + item.organizadas, 0);
  return <section className="rounded-card border border-border-default bg-surface-card p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">Ritmo de organização</p><h3 className="mt-1 text-base font-semibold text-text-primary">Unidades conferidas nos últimos 7 dias</h3></div><strong className="text-2xl font-semibold text-text-primary">{total}</strong></div>{total > 0 ? <div className="mt-4 h-28"><AreaChart data={ritmo} aspectRatio="auto" style={{ height: 112 }} animationDuration={500}><Grid horizontal stroke="var(--border-subtle)" hideHorizontalEdgeLines /><Area dataKey="organizadas" fill="var(--accent)" fillOpacity={0.12} stroke="var(--accent)" strokeWidth={2} fadeEdges /><XAxis numTicks={3} /></AreaChart></div> : <p className="mt-4 rounded-control border border-dashed border-border-default p-5 text-sm text-text-muted">Ainda não há endereços conferidos neste período.</p>}<p className="mt-3 border-t border-border-subtle pt-3 text-xs leading-5 text-text-muted">Conta unidades que receberam um endereço físico em cada dia. Mudanças anteriores à implantação não aparecem.</p></section>;
}

function StockListRow({ unidade, resultado, acoes }: { unidade: UnidadeEstoque | null; resultado: ReturnType<typeof buscarPecas>[number]; acoes: AcoesUnidade }) {
  if (!unidade) return <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-negative/40 bg-negative-bg p-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-text-primary">{resultado.peca.codigoLegado}</strong><span className="rounded-badge border border-negative/30 bg-surface-card px-1.5 py-0.5 text-[10px] font-semibold text-negative">Sem estoque</span></div><p className="mt-1 truncate text-sm font-semibold text-text-secondary">{resultado.peca.nome}</p><p className="mt-1 text-xs text-negative">0 unidades físicas cadastradas</p></div>{acoes.podeCriar ? <button type="button" onClick={() => acoes.onAddUnit(resultado.peca)} aria-label={`Adicionar unidade a ${resultado.peca.codigoLegado}`} className={botaoSecundario}><Plus size={15} />Adicionar unidade</button> : <span className="text-xs text-text-muted">Sem permissão para cadastrar</span>}</motion.div>;
  return <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="flex items-center gap-3 rounded-control border border-border-default bg-surface-card p-3 transition hover:border-accent/35 hover:shadow-md"><button type="button" aria-label={`Ver detalhes de ${unidade.sku}`} onClick={() => acoes.onOpen(unidade)} className="min-w-0 flex-1 cursor-pointer rounded-control text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-text-primary">{unidade.sku}</strong><span className="rounded-badge border border-border-default bg-surface-inset px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">{resultado.categoria.nome}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${estadoClass(unidade)}`}>{estadoLabel(unidade)}</span></div><p className="mt-1 truncate text-sm font-semibold text-text-secondary">{resultado.peca.nome}</p><p className="mt-1 truncate text-xs text-text-muted">{unidade.endereco ?? "Sem endereço"} · <strong className="text-text-primary">{moeda(unidade.preco)}</strong></p></button><ActionMenu unidade={unidade} acoes={acoes} /></motion.div>;
}

// A quantidade carregada e a posição de rolagem ficam no componente pai:
// trocar de aba ou recarregar os dados (após reservar, editar…) não devolve a
// lista ao topo. Só uma nova busca/filtro recomeça do início.
function InventoryCatalogViewport({ resultados, visualizacao, acoes, visibleCount, setVisibleCount, rolagem }: { resultados: ReturnType<typeof buscarPecas>; visualizacao: Visualizacao; acoes: AcoesUnidade; visibleCount: number; setVisibleCount: (atualizar: (valor: number) => number) => void; rolagem: MutableRefObject<number> }) {
  const painel = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (painel.current) painel.current.scrollTop = rolagem.current;
  }, [rolagem]);
  const visibleResultados = resultados.slice(0, visibleCount);
  const unidades = visibleResultados.flatMap((resultado) => resultado.unidades.length ? resultado.unidades.map((unidade) => ({ unidade, resultado })) : [{ unidade: null, resultado }]);
  const hasMore = visibleCount < resultados.length;
  function carregarMais(event: UIEvent<HTMLDivElement>) {
    rolagem.current = event.currentTarget.scrollTop;
    if (!hasMore) return;
    const element = event.currentTarget;
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - 120) setVisibleCount((count) => Math.min(count + 6, resultados.length));
  }
  return <section aria-label="Lista de itens do estoque" className="relative mt-3 overflow-hidden rounded-card border border-border-default bg-surface-card"><div ref={painel} onScroll={carregarMais} tabIndex={0} className="no-scrollbar max-h-[min(68vh,720px)] overflow-y-auto overscroll-contain p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/20"><div className={visualizacao === "cards" ? "grid gap-3 xl:grid-cols-2" : "space-y-2"}><AnimatePresence initial={false} mode="popLayout">{visualizacao === "cards" ? visibleResultados.map((resultado) => <motion.div key={resultado.peca.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="min-w-0"><PieceCard resultado={resultado} acoes={acoes} /></motion.div>) : unidades.map(({ unidade, resultado }) => <StockListRow key={unidade?.id ?? resultado.peca.id} unidade={unidade} resultado={resultado} acoes={acoes} />)}</AnimatePresence></div>{!visibleResultados.length && <div className="rounded-control border border-dashed border-border-default p-8 text-center text-sm text-text-muted">Nenhum item encontrado. Tente nome, categoria, moto, código ou endereço.</div>}<div aria-live="polite" className="pt-3 text-center text-[11px] text-text-faint">{hasMore ? "Role para carregar mais itens" : "Todos os itens carregados"}</div></div><div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-surface-card to-transparent" /></section>;
}

function clienteDemo(id: string, nome: string, telefone: string): Cliente {
  return { id, nome, telefone, documento: null, data_nascimento: null, origem: "balcao", preferencia_contato: "whatsapp", tags: [], observacoes: null, ativo: true, banido: false, cidade: null, estado: null, criado_em: "2026-09-01T12:00:00.000Z", atualizado_em: "2026-09-01T12:00:00.000Z" } as Cliente;
}
// Clientes e formas fictícios só para a demonstração local exercitar o vínculo.
const clientesDemo: Cliente[] = [
  clienteDemo("cliente-demo-1", "Cliente demonstração A", "(83) 90000-0001"),
  clienteDemo("cliente-demo-2", "Cliente demonstração B", "(83) 90000-0002"),
];
const formasDemo = [{ id: "forma-demo-pix", nome: "PIX" }, { id: "forma-demo-dinheiro", nome: "DINHEIRO" }];

export interface EstoquePreviewProps {
  /** Dentro do app (/estoque): usa o tema e o cabeçalho do app, sem a moldura da rota isolada. */
  embutido?: boolean;
  /** Abre a tela antiga (/estoque-antigo): anúncios, famílias, gavetas e edição completa. */
  onAbrirEstoqueAntigo?: () => void;
  /** Vindo do Dashboard ("estoque baixo"): abre o catálogo já filtrado. */
  filtroEstoqueBaixoInicial?: boolean;
  onFiltroEstoqueBaixoAplicado?: () => void;
}

export function EstoquePreview({ embutido = false, onAbrirEstoqueAntigo, filtroEstoqueBaixoInicial = false, onFiltroEstoqueBaixoAplicado }: EstoquePreviewProps = {}) {
  const { pode } = usePermissao();
  // Dentro do app nunca mostra peças fictícias: começa vazio até a API responder.
  const [estoque, setEstoque] = useState<EstoquePreviewState>(() => embutido ? { categorias: [], pecas: [], unidades: [], categoriasPorSecao: {}, prioridadesPorSecao: {}, locais: [] } : criarEstoqueDemo());
  const [fonte, setFonte] = useState<"demo" | "real">("demo");
  const [carregandoReal, setCarregandoReal] = useState(true);
  const [erroReal, setErroReal] = useState<string | null>(null);
  const [erroOrganizacao, setErroOrganizacao] = useState<string | null>(null);
  const [recursos, setRecursos] = useState<RecursosOrganizacao>(RECURSOS_DEMONSTRACAO);
  const [reloadKey, setReloadKey] = useState(0);
  const [aba, setAba] = useState<Aba>("atendimento");
  const [busca, setBusca] = useState("");
  const [visualizacao, setVisualizacao] = useState<Visualizacao>("cards");
  const [composerAberto, setComposerAberto] = useState(false);
  const [pecaParaUnidade, setPecaParaUnidade] = useState<string | null>(null);
  const [unidadeDetalhando, setUnidadeDetalhando] = useState<UnidadeEstoque | null>(null);
  const [pecaResumoId, setPecaResumoId] = useState<string | null>(null);
  const [unidadeEditando, setUnidadeEditando] = useState<UnidadeEstoque | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<UnidadeEstoque | null>(null);
  const [motivoArquivamento, setMotivoArquivamento] = useState("");
  const [processando, setProcessando] = useState(false);
  const [restaurando, setRestaurando] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; texto: string } | null>(null);
  const [baixasPendentes, setBaixasPendentes] = useState<BaixaPendente[]>([]);
  const [conferenciaAberta, setConferenciaAberta] = useState(false);
  const [soEstoqueBaixo, setSoEstoqueBaixo] = useState(filtroEstoqueBaixoInicial);
  const [visiveis, setVisiveis] = useState(6);
  const rolagemCatalogo = useRef(0);
  const buscaRef = useRef<HTMLInputElement>(null);
  const [clientesReais, setClientesReais] = useState<Cliente[]>([]);
  const [formasReais, setFormasReais] = useState<{ id: string; nome: string }[]>([]);
  const conexaoRealPronta = fonte === "real" && !carregandoReal && !erroReal && !erroOrganizacao;
  const conexaoPermiteGravar = (fonte === "demo" && !embutido) || conexaoRealPronta;
  // Permissões granulares (mesmas chaves que a API exige): sem elas a tela
  // vira consulta em vez de exibir ações que só falhariam no envio.
  const podeEditar = pode("estoque.editar");
  const podeCriar = pode("estoque.criar");
  const podeAlterar = conexaoPermiteGravar && podeEditar;
  const podeCadastrar = conexaoPermiteGravar && podeCriar;
  const metricas = getMetricas(estoque);
  const todosResultados = useMemo(() => buscarPecas(estoque, busca), [estoque, busca]);
  const resultadoResumo = useMemo(() => pecaResumoId ? buscarPecas(estoque, "").find((item) => item.peca.id === pecaResumoId) ?? null : null, [estoque, pecaResumoId]);
  const resultados = useMemo(() => soEstoqueBaixo ? filtrarEstoqueBaixo(todosResultados) : todosResultados, [todosResultados, soEstoqueBaixo]);
  const sobras = useMemo(() => pecasComFichasSobrando(estoque.pecas, estoque.unidades), [estoque]);
  const pendenciasConferencia = baixasPendentes.length + sobras.length;
  const arquivados = useMemo(() => estoque.unidades.filter((unidade) => unidade.estado === "arquivada" && (!busca || buscarPecas(estoque, busca, true).some((item) => item.unidades.some((candidato) => candidato.id === unidade.id)))), [estoque, busca]);
  const triagem = estoque.unidades.filter((unidade) => unidade.estado !== "arquivada" && unidade.estado !== "reservada" && (unidade.estado === "organizar" || !unidade.endereco));
  const pecaPorId = (id: string) => estoque.pecas.find((peca) => peca.id === id) ?? null;
  // O drawer lê a unidade atualizada do estado (após reservar/liberar/recarregar),
  // não a cópia guardada no clique que o abriu.
  const unidadeSelecionada = unidadeDetalhando ?? unidadeEditando;
  const unidadeAberta = unidadeSelecionada ? estoque.unidades.find((item) => item.id === unidadeSelecionada.id) ?? unidadeSelecionada : null;
  const enderecosReais = (estoque.locais ?? []).filter((local) => local.ativo).map((local) => ({ value: local.codigo, label: `${local.codigo} · ${local.deposito}, zona ${local.zona}, prateleira ${local.prateleira}, seção ${local.secao}` }));
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let ativo = true;
    setCarregandoReal(true);
    async function carregarEstoqueReal() {
      try {
        const [estoqueResposta, categoriasResposta, organizacaoResposta] = await Promise.all([
          estoqueApi.listar(),
          categoriasApi.listar(),
          organizacaoApi.listar().catch(() => null),
        ]);
        if (!estoqueResposta.success) throw new Error(estoqueResposta.error || "Não foi possível carregar o estoque");
        if (!categoriasResposta.success) throw new Error(categoriasResposta.error || "Não foi possível carregar as categorias");
        if (!ativo) return;
        const organizacao = organizacaoResposta?.success ? organizacaoResposta.data : null;
        setEstoque(adaptarEstoqueReal(estoqueResposta.data ?? [], categoriasResposta.data ?? [], organizacao?.locais ?? [], organizacao?.categorias ?? [], organizacao?.reservas ?? []));
        setRecursos(organizacao?.recursos ?? { clienteNaReserva: false, reservaComSinal: false });
        setBaixasPendentes(organizacao?.baixasPendentes ?? []);
        setErroOrganizacao(organizacao ? null : organizacaoResposta?.error ?? "Locais físicos indisponíveis");
        setFonte("real");
        setErroReal(null);
      } catch (erro) {
        if (ativo) setErroReal(erro instanceof Error ? erro.message : "Não foi possível carregar os dados reais");
      } finally {
        if (ativo) setCarregandoReal(false);
      }
    }
    void carregarEstoqueReal();
    return () => { ativo = false; };
  }, [reloadKey]);

  useEffect(() => {
    if (fonte !== "real") return;
    let ativo = true;
    clientesApi.listar().then((resposta) => { if (ativo && resposta.success) setClientesReais(resposta.data ?? []); }).catch(() => undefined);
    formasPagamentoApi.listar().then((resposta) => {
      if (ativo && resposta.success) setFormasReais((resposta.data ?? []).filter((forma) => forma.natureza !== "fiado").map((forma) => ({ id: forma.id, nome: forma.nome })));
    }).catch(() => undefined);
    return () => { ativo = false; };
  }, [fonte, reloadKey]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  // Buscar (botão do cabeçalho ou ⌘K/Ctrl+K, como em Tarefas): leva ao
  // catálogo e põe o cursor no campo de busca.
  const abrirBusca = useCallback(() => {
    setAba((atual) => atual === "arquivados" ? atual : "atendimento");
    window.setTimeout(() => buscaRef.current?.focus(), 60);
  }, []);
  useEffect(() => {
    const atalho = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); abrirBusca(); }
    };
    window.addEventListener("keydown", atalho);
    return () => window.removeEventListener("keydown", atalho);
  }, [abrirBusca]);

  // Atalho do Dashboard: aplica o filtro uma vez e avisa o app que já usou.
  useEffect(() => {
    if (!filtroEstoqueBaixoInicial) return;
    setSoEstoqueBaixo(true);
    onFiltroEstoqueBaixoAplicado?.();
  }, [filtroEstoqueBaixoInicial, onFiltroEstoqueBaixoAplicado]);

  // Nova busca ou filtro recomeça a lista do topo; recarga de dados, não.
  useEffect(() => {
    setVisiveis(6);
    rolagemCatalogo.current = 0;
  }, [busca, soEstoqueBaixo]);

  function avisar(mensagem: string) {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), texto: mensagem });
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }

  async function reservar(reserva: ReservaUnidadeInput): Promise<boolean> {
    const unidade = unidadeAberta;
    if (!unidade) return false;
    if (fonte === "demo") {
      setEstoque((atual) => reservarUnidade(atual, unidade.id, reserva));
      avisar(`Unidade reservada para ${reserva.nome} na demonstração`);
      return true;
    }
    if (!conexaoRealPronta) { avisar("Conexão indisponível. Atualize os dados antes de reservar."); return false; }
    try {
      const resposta = await organizacaoApi.reservar(unidade.id, { clienteId: recursos.clienteNaReserva ? reserva.clienteId : null, responsavel: reserva.nome, dias: reserva.dias, valorSinal: reserva.valorSinal, formaPagamentoId: reserva.formaPagamentoId });
      if (!resposta.success) throw new Error(resposta.error || "Não foi possível reservar a unidade.");
      avisar(`Unidade reservada para ${resposta.data?.responsavel ?? reserva.nome} · sinal de ${moeda(reserva.valorSinal)}.`);
      return true;
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Falha ao reservar unidade.");
      return false;
    } finally {
      setReloadKey((valor) => valor + 1);
    }
  }

  async function liberarReserva(): Promise<boolean> {
    const unidade = unidadeAberta;
    if (!unidade) return false;
    if (fonte === "demo") {
      setEstoque((atual) => liberarReservaUnidade(atual, unidade.id));
      avisar("Reserva liberada na demonstração");
      return true;
    }
    if (!conexaoRealPronta || !unidade.reservaId) { avisar("Conexão indisponível. Atualize os dados antes de liberar."); return false; }
    try {
      const resposta = await estoqueApi.liberarReserva(unidade.reservaId);
      if (!resposta.success) throw new Error(resposta.error || "Não foi possível liberar a reserva.");
      avisar("Reserva liberada. A unidade voltou a ficar disponível.");
      return true;
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Falha ao liberar reserva.");
      return false;
    } finally {
      setReloadKey((valor) => valor + 1);
    }
  }

  async function salvarEdicao(alteracoes: Partial<Pick<UnidadeEstoque, "preco" | "grau" | "origem" | "endereco">>) {
    const unidade = unidadeEditando ?? unidadeDetalhando;
    if (!unidade) return;
    if (!podeEditarUnidade(unidade)) { avisar("Unidade vendida ou arquivada: a ficha é somente consulta."); return; }
    if (fonte === "real") {
      if (!conexaoRealPronta) { avisar("Conexão indisponível. Atualize os dados antes de editar."); return; }
      const local = alteracoes.endereco ? estoque.locais?.find((item) => item.codigo === alteracoes.endereco && item.ativo) : null;
      if (alteracoes.endereco && !local) { avisar("Escolha um local cadastrado e ativo."); return; }
      // Só o que mudou vai para o banco: preço herdado da peça continua
      // herdado e a nota exata (ex.: 7) não vira 6 só por abrir a edição.
      const payload: UnidadeFichaPayload = {};
      if (alteracoes.preco !== undefined && alteracoes.preco !== unidade.preco) payload.valor = alteracoes.preco ?? null;
      if (alteracoes.grau && alteracoes.grau !== unidade.grau) payload.condicao_nota = alteracoes.grau === "A" ? 9 : alteracoes.grau === "C" ? 3 : 6;
      if (alteracoes.endereco !== undefined && (alteracoes.endereco ?? null) !== (unidade.endereco ?? null)) payload.endereco_id = local?.id ?? null;
      if (alteracoes.origem !== undefined && (alteracoes.origem?.trim() || null) !== (unidade.origem ?? null)) payload.origem_identificacao = alteracoes.origem?.trim() || null;
      if (!Object.keys(payload).length) {
        setUnidadeDetalhando(null);
        setUnidadeEditando(null);
        avisar("Nada mudou nesta unidade.");
        return;
      }
      try {
        // Uma única gravação (transação no banco) com tudo que mudou.
        const resposta = await organizacaoApi.editarUnidade(unidade.id, payload);
        if (!resposta.success) throw new Error(resposta.error || "Não foi possível salvar a unidade. Nada foi alterado.");
        setReloadKey((valor) => valor + 1);
        setUnidadeDetalhando(null);
        setUnidadeEditando(null);
        avisar("Unidade atualizada no estoque.");
      } catch (erro) {
        setReloadKey((valor) => valor + 1);
        avisar(erro instanceof Error ? erro.message : "Falha ao atualizar unidade.");
      }
      return;
    }
    setEstoque((atual) => editarUnidade(atual, unidade.id, alteracoes));
    setUnidadeDetalhando(null);
    setUnidadeEditando(null);
    avisar("Unidade atualizada na demonstração");
  }

  function abrirArquivamento(unidade: UnidadeEstoque) {
    setMotivoArquivamento("");
    setArchiveTarget(unidade);
  }

  const motivoValido = fonte === "demo" || (motivoArquivamento.trim().length >= 3 && motivoArquivamento.trim().length <= 240);

  async function arquivar() {
    if (!archiveTarget || processando) return;
    if (fonte === "real") {
      if (!conexaoRealPronta) { avisar("Conexão indisponível. Atualize os dados antes de arquivar."); return; }
      if (!motivoValido) return;
      setProcessando(true);
      try {
        const resposta = await estoqueApi.arquivarUnidadeOperacional(archiveTarget.id, motivoArquivamento.trim());
        if (!resposta.success) throw new Error(resposta.error || "Não foi possível arquivar a unidade.");
        setArchiveTarget(null);
        avisar("Unidade arquivada · histórico preservado. Restaure na aba Arquivados se precisar.");
      } catch (erro) {
        avisar(erro instanceof Error ? erro.message : "Falha ao arquivar a unidade.");
      } finally {
        setProcessando(false);
        setReloadKey((valor) => valor + 1);
      }
      return;
    }
    setEstoque((atual) => arquivarUnidade(atual, archiveTarget.id, motivoArquivamento.trim() || "Arquivada pela equipe"));
    setArchiveTarget(null);
    avisar("Unidade arquivada na demonstração · histórico preservado");
  }

  async function restaurar(unidade: UnidadeEstoque) {
    if (fonte === "demo") {
      setEstoque((atual) => restaurarUnidade(atual, unidade.id));
      avisar("Unidade restaurada");
      return;
    }
    if (!conexaoRealPronta) { avisar("Conexão indisponível. Atualize os dados antes de restaurar."); return; }
    setRestaurando(unidade.id);
    try {
      const resposta = await estoqueApi.restaurarUnidadeOperacional(unidade.id);
      if (!resposta.success) throw new Error(resposta.error || "Não foi possível restaurar a unidade.");
      avisar("Unidade restaurada ao estoque ativo.");
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Falha ao restaurar a unidade.");
    } finally {
      setRestaurando(null);
      setReloadKey((valor) => valor + 1);
    }
  }

  async function conferirBaixa(baixa: BaixaPendente, unidadeCorretaId: string | null): Promise<boolean> {
    if (!conexaoRealPronta) { avisar("Conexão indisponível. Atualize os dados antes de conferir."); return false; }
    try {
      const resposta = await organizacaoApi.conferirBaixa(baixa.id, unidadeCorretaId);
      if (!resposta.success) throw new Error(resposta.error || "Não foi possível conferir a baixa.");
      avisar(unidadeCorretaId ? "Baixa corrigida: a unidade certa saiu e a outra voltou ao estoque." : "Baixa conferida.");
      return true;
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Falha ao conferir a baixa.");
      return false;
    } finally {
      setReloadKey((valor) => valor + 1);
    }
  }

  async function baixarFichaExcedente(unidade: UnidadeEstoque): Promise<boolean> {
    if (!conexaoRealPronta) { avisar("Conexão indisponível. Atualize os dados antes de conferir."); return false; }
    try {
      const resposta = await organizacaoApi.baixarFichaExcedente(unidade.id);
      if (!resposta.success) throw new Error(resposta.error || "Não foi possível baixar a ficha.");
      avisar(`${unidade.sku} marcada como vendida. A quantidade da peça não mudou.`);
      return true;
    } catch (erro) {
      avisar(erro instanceof Error ? erro.message : "Falha ao baixar a ficha.");
      return false;
    } finally {
      setReloadKey((valor) => valor + 1);
    }
  }

  const carregarHistorico = useCallback(async (unidade: UnidadeEstoque): Promise<HistoricoCarregado> => {
    if (fonte === "demo" || unidade.individualizada === false) return { eventos: historicoDemonstracao(unidade), autoriaRegistrada: false, demonstracao: fonte === "demo" };
    const resposta = await organizacaoApi.historico(unidade.id);
    if (!resposta.success) throw new Error(resposta.error || "Não foi possível carregar o histórico.");
    return resposta.data;
  }, [fonte]);

  const acoes: AcoesUnidade = {
    onOpen: setUnidadeDetalhando,
    onOpenSummary: setPecaResumoId,
    onEdit: setUnidadeEditando,
    onArchive: abrirArquivamento,
    onAddUnit: (peca) => { setPecaParaUnidade(peca.id); setComposerAberto(true); },
    podeArquivar: podeAlterar,
    podeEditar: podeAlterar,
    podeCriar: podeCadastrar,
    onConferir: fonte === "real" && recursos.baixaAutomatica ? () => setConferenciaAberta(true) : undefined,
  };

  const statusConexao = carregandoReal ? "Conectando" : fonte === "real" ? (conexaoRealPronta ? "Estoque real · sincronizado" : "Somente leitura") : "Demonstração local";
  const abas = [["atendimento", "Atendimento", metricas.totalAtivas], ["organizar", "Organizar", metricas.paraOrganizar], ["mapa", "Mapa físico", fonte === "real" ? (estoque.locais ?? []).filter((local) => local.ativo).length : 88], ["arquivados", fonte === "real" ? "Fora do ativo" : "Arquivados", metricas.arquivadas]] as const;
  const mostrarConteudo = !embutido || fonte === "real";

  // Identidade visual = a da tela Tarefas (modo claro): mesma casca, cabeçalho,
  // tipografia, abas segmentadas e cartões (decisão do usuário, 24/09/2026).
  const campoBusca = <label className="relative block w-full sm:w-[320px]"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" size={16} /><input ref={buscaRef} aria-label="Buscar no estoque" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar peça, moto, SKU ou endereço" className="h-11 w-full rounded-lg border border-border-default bg-surface-card pl-10 pr-3 text-base outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm" /></label>;
  const tokens = lightInventoryTokens;
  return <InventoryTokensContext.Provider value={tokens}><div style={tokens} data-project="rk-sucatas-new" className="min-h-screen w-full min-w-0 overflow-x-hidden bg-surface-page font-[Geist,Inter,ui-sans-serif,system-ui] text-text-primary [&_button]:cursor-pointer">
    <header className="sticky top-0 z-[60] border-b border-border-default bg-surface-card/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex min-w-0 max-w-[1440px] items-center gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid size-7 place-items-center rounded bg-accent text-[10px] font-black text-white">RK</div>
          <div className="min-w-0"><p className="truncate text-sm font-semibold tracking-tight">RK Sucatas</p><p className="truncate font-mono text-[9px] uppercase tracking-[0.12em] text-text-faint">Estoque do galpão · {fonte === "real" ? "sistema integrado" : "demonstração"}</p></div>
        </div>
        <div className="ml-auto hidden items-center gap-5 text-xs text-text-muted lg:flex"><span className="inline-flex items-center gap-2">{fonte === "real" && conexaoRealPronta ? <DotMatrix sequence={[[0, 1, 3, 4, 6, 7, 9, 10, 12, 13, 15], [1, 4, 7, 10, 13]]} rows={4} cols={4} dotSize={3} gap={2} interval={900} color="var(--positive)" inactiveColor="var(--positive-bg)" /> : <span className={`size-2 rounded-full ${carregandoReal ? "bg-accent" : "bg-warning"}`} />}{statusConexao}</span></div>
        {onAbrirEstoqueAntigo && <button type="button" aria-label="Anúncios e ferramentas antigas" title="Anúncios, famílias e gavetas (tela antiga)" onClick={onAbrirEstoqueAntigo} className="ml-auto grid size-11 shrink-0 place-items-center rounded-lg border border-border-default text-text-muted hover:border-accent/40 hover:bg-accent-soft-bg lg:ml-0 sm:flex sm:w-auto sm:gap-2 sm:px-3"><ExternalLink size={15} /><span className="hidden sm:inline">Tela antiga</span></button>}
        <button type="button" onClick={abrirBusca} aria-label="Buscar peça, moto, SKU ou endereço" className={`grid size-11 shrink-0 place-items-center rounded-lg border border-border-default text-text-muted hover:border-accent/40 hover:bg-accent-soft-bg sm:flex sm:w-auto sm:gap-2 sm:px-3 ${onAbrirEstoqueAntigo ? "" : "ml-auto lg:ml-0"}`}><Search size={15} /><span className="hidden sm:inline">Buscar</span><kbd className="hidden rounded border border-border-default px-1 font-mono text-[10px] text-text-faint sm:inline">⌘K</kbd></button>
        {podeCriar ? <Button variant="default" size="sm" aria-label="Nova peça" disabled={!podeCadastrar} onClick={() => { setPecaParaUnidade(null); setComposerAberto(true); }} className="size-11 shrink-0 rounded-lg bg-accent text-white hover:bg-accent-hover sm:h-9 sm:w-[154px] sm:rounded-md"><PackagePlus size={15} /><span className="hidden sm:inline">Nova peça</span></Button> : <span className="rounded-md bg-surface-inset px-3 py-1.5 text-xs font-semibold text-text-muted">Somente consulta</span>}
      </div>
    </header>
    <main className="mx-auto w-full min-w-0 max-w-[1440px] overflow-x-hidden px-3 pb-[calc(6rem_+_env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:py-7 lg:py-10">
      <div aria-live="polite" style={{ zIndex: "var(--z-toast)" }} className="pointer-events-none fixed inset-x-0 bottom-24 flex justify-center px-4 md:bottom-5"><AnimatePresence>{toast && <motion.div key={toast.id} role="status" initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ type: "spring", stiffness: 420, damping: 32 }} className="pointer-events-auto max-w-md rounded-control border border-accent/25 bg-surface-card px-4 py-3 text-sm font-semibold text-accent-soft-fg shadow-lg">{toast.texto}</motion.div>}</AnimatePresence></div>
      <div className="flex flex-col gap-5 border-b border-border-default pb-0 lg:flex-row lg:items-end lg:justify-between">
        <div className="pb-5"><SurfaceLabel>Operação do galpão · atendimento e organização</SurfaceLabel><h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em] text-text-primary sm:text-4xl">Estoque</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">Peça é o nome que você busca. Unidade é a peça física, com seu próprio preço, foto, estado e endereço.</p></div>
        {mostrarConteudo && <div className="-mx-3 flex w-[calc(100%+1.5rem)] overflow-x-auto px-3 pb-5 sm:mx-0 sm:w-full sm:justify-end sm:px-0 lg:w-auto"><SegmentTabs value={aba} onValueChange={(valor) => setAba(valor as Aba)}><SegmentTabsList className="max-w-full shrink-0 bg-surface-inset">{abas.map(([id, nome, total]) => <SegmentTabsTrigger key={id} value={id} className="shrink-0 whitespace-nowrap text-sm">{nome} <span className="ml-1 text-[11px] text-text-faint">{total}</span></SegmentTabsTrigger>)}</SegmentTabsList></SegmentTabs></div>}
      </div>
      <AnimatePresence initial={false} mode="wait">
        {carregandoReal ? <motion.div key="carregando" role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-5 flex items-center gap-2 rounded-card border border-accent/25 bg-accent-soft-bg px-4 py-3 text-sm text-accent-soft-fg"><Loader2 size={16} className="animate-spin" />Carregando categorias e itens reais do estoque…</motion.div>
          : fonte === "real" ? (conexaoRealPronta ? null : <motion.div key="leitura" role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`mb-4 flex flex-wrap items-center gap-x-2 gap-y-2 rounded-card border px-4 py-3 text-sm ${conexaoRealPronta ? "border-accent/25 bg-accent-soft-bg text-accent-soft-fg" : "border-warning/30 bg-warning-bg text-text-primary"}`}><strong>{conexaoRealPronta ? "Você está no estoque real." : "Dados antigos em modo somente leitura."}</strong><span>{conexaoRealPronta ? `Cadastros, edições, endereços, reservas e arquivamentos feitos aqui são gravados no sistema pela API.${podeEditar ? "" : " Seu usuário não tem permissão de edição: a tela está em modo consulta."}` : `Não foi possível confirmar o estado atual: ${erroReal ?? erroOrganizacao}. Não faça alterações até reconectar.`}</span>{!conexaoRealPronta && <button type="button" onClick={() => setReloadKey((valor) => valor + 1)} className={`${botaoSecundario} min-h-9`}>Tentar novamente</button>}</motion.div>)
          : embutido ? <motion.div key="falha" role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2 rounded-card border border-danger/30 bg-danger-bg px-4 py-3 text-sm text-text-primary"><strong>Não foi possível carregar o estoque.</strong><span>{erroReal ?? "Sem resposta do servidor."} Nenhuma peça é exibida para não vender com dado errado.</span><button type="button" onClick={() => setReloadKey((valor) => valor + 1)} className={`${botaoSecundario} min-h-9`}>Tentar novamente</button></motion.div>
          : <motion.div key="demo" role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2 rounded-card border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-text-primary"><strong>Dados demonstrativos.</strong><span>Não foi possível carregar o estoque real{erroReal ? `: ${erroReal}` : "."} Nada feito nesta tela será gravado enquanto a conexão não voltar.</span><button type="button" onClick={() => setReloadKey((valor) => valor + 1)} className={`${botaoSecundario} min-h-9`}>Tentar conectar</button></motion.div>}
      </AnimatePresence>
      {mostrarConteudo && <AnimatePresence initial={false} mode="wait"><motion.div key={aba} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ type: "spring", stiffness: 340, damping: 31, bounce: 0 }} role="tabpanel" aria-label={abas.find(([id]) => id === aba)?.[1] ?? "Estoque"} className="mt-6">
      {aba === "atendimento" && <>{fonte === "real" && recursos.baixaAutomatica && pendenciasConferencia > 0 && <div role="note" className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-card border border-warning/30 bg-warning-bg px-4 py-3 text-sm text-text-primary"><span><strong>{pendenciasConferencia === 1 ? "1 conferência pendente." : `${pendenciasConferencia} conferências pendentes.`}</strong> {baixasPendentes.length ? `${baixasPendentes.length} ${baixasPendentes.length === 1 ? "venda saiu" : "vendas saíram"} sem escolher a unidade` : "Há fichas sobrando de vendas antigas"}; confirme qual peça física saiu.</span><button type="button" onClick={() => setConferenciaAberta(true)} className={`${botaoSecundario} min-h-9`}><ClipboardCheck size={15} />Conferir agora</button></div>}<InventoryMetricStrip metricas={metricas} /><div className="mt-6 flex flex-wrap items-center justify-between gap-3"><div><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Catálogo unificado</p><h2 className="mt-1 text-lg font-semibold">Peças por categoria</h2><p className="mt-1 text-xs text-text-muted">Role dentro do painel para carregar mais itens sem perder as estatísticas.</p></div><div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{campoBusca}<button type="button" aria-pressed={soEstoqueBaixo} onClick={() => setSoEstoqueBaixo((valor) => !valor)} className={`inline-flex min-h-11 items-center gap-1.5 rounded-control border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 ${soEstoqueBaixo ? "border-warning/40 bg-warning-bg text-warning" : "border-border-default bg-surface-card text-text-secondary hover:border-accent/40"}`}>Estoque baixo (1–2)</button><div role="group" aria-label="Modo de visualização" className="flex rounded-control border border-border-default bg-surface-card p-1">{([["cards", "Visualização em cartões", LayoutGrid], ["lista", "Visualização em lista", List]] as const).map(([valor, rotulo, Icone]) => <button key={valor} type="button" aria-label={rotulo} aria-pressed={visualizacao === valor} onClick={() => setVisualizacao(valor)} className={`grid size-10 place-items-center rounded-[6px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 ${visualizacao === valor ? "bg-accent-soft-bg text-accent-soft-fg" : "text-text-faint hover:text-text-primary"}`}><Icone size={16} /></button>)}</div></div></div><InventoryCatalogViewport resultados={resultados} visualizacao={visualizacao} acoes={acoes} visibleCount={visiveis} setVisibleCount={setVisiveis} rolagem={rolagemCatalogo} /><aside className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-control border border-border-default border-l-4 border-l-accent bg-surface-card p-4"><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Preços conhecidos</p><p className="mt-1 text-sm font-semibold"><span className="text-base">{metricas.unidadesComPreco}</span> de {metricas.totalAtivas} unidades</p><p className="mt-1 text-xs leading-5 text-text-muted">O valor em estoque considera apenas preços definidos.</p></div><div className="rounded-control border border-border-default border-l-4 border-l-accent bg-surface-card p-4"><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Origem</p><p className="mt-1 text-sm font-semibold">Não identificada é válida</p><p className="mt-1 text-xs leading-5 text-text-muted">Não invente a moto doadora quando ela for desconhecida.</p></div><div className="rounded-control border border-border-default border-l-4 border-l-border-default bg-surface-card p-4"><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Endereços físicos</p><p className="mt-1 text-sm font-semibold">{fonte === "real" ? <><span className="text-base">{enderecosReais.length}</span> locais ativos</> : "Endereços demonstrativos"}</p><p className="mt-1 text-xs leading-5 text-text-muted">Cadastre os locais reais no mapa antes de atribuí-los às unidades.</p>{fonte === "real" && podeAlterar && <button type="button" onClick={() => setAba("mapa")} className="mt-2 inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-accent hover:underline"><MapPin size={13} />Abrir mapa físico</button>}</div></aside><div className="mt-6"><StockRhythmCard unidades={estoque.unidades} /></div></>}
      {aba === "organizar" && <section className="rounded-card border border-border-default bg-surface-card p-5"><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-warning">Fila operacional</p><h2 className="mt-1 text-xl font-semibold">Peças para organizar</h2><p className="mt-1 text-sm text-text-muted">Escolha um endereço quando souber. Unidades sem endereço continuam visíveis no catálogo para conferência; valide a disponibilidade antes de vender.</p><div className="mt-4 space-y-2"><AnimatePresence initial={false}>{triagem.map((unidade) => <motion.div layout key={unidade.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 12 }} className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border-default p-3"><div><strong>{unidade.sku}</strong><span className="ml-2 text-sm text-text-secondary">{pecaPorId(unidade.pecaId)?.nome}</span><p className="mt-1 text-xs text-text-muted">{unidade.individualizada === false ? "Quantidade legada sem ficha individual" : unidade.origem ?? "Origem não identificada"} · Sem endereço definitivo</p></div>{unidade.individualizada === false ? <span className="text-xs text-text-muted">Individualização pendente</span> : podeAlterar ? <button type="button" onClick={() => setUnidadeEditando(unidade)} className={botaoSecundario}><MapPin size={15} />Definir endereço</button> : <span className="text-xs text-text-muted">Somente consulta</span>}</motion.div>)}</AnimatePresence>{!triagem.length && <p className="rounded-control border border-dashed border-border-default p-6 text-center text-sm text-text-muted">Nenhuma unidade aguardando endereço. A fila está em dia.</p>}</div></section>}
      {aba === "mapa" && <InventoryMap operacional={fonte === "real"} podeAlterar={podeAlterar} locais={estoque.locais ?? []} categorias={estoque.categorias} categoriasPorSecao={estoque.categoriasPorSecao} prioridadesPorSecao={estoque.prioridadesPorSecao} unidades={estoque.unidades} onCriarLocal={async (local) => {
        if (!conexaoRealPronta) throw new Error("Conexão indisponível. Atualize os dados antes de cadastrar locais.");
        const resposta = await estoqueApi.criarLocal(local);
        if (!resposta.success) throw new Error(resposta.error || "Não foi possível cadastrar o local.");
        setReloadKey((valor) => valor + 1);
        avisar("Local cadastrado.");
      }} onAtualizarLocal={async (local, alteracoes) => {
        if (!conexaoRealPronta) throw new Error("Conexão indisponível. Atualize os dados antes de editar o local.");
        const resposta = await organizacaoApi.atualizarLocal(local.id, alteracoes);
        if (!resposta.success) throw new Error(resposta.error || "Não foi possível atualizar o local.");
        setReloadKey((valor) => valor + 1);
        avisar(alteracoes.ativo === false ? `Local ${local.codigo} desativado.` : alteracoes.ativo ? `Local ${local.codigo} reativado.` : "Local atualizado.");
      }} onAlternarCategoria={async (codigo, categoriaId, adicionar) => {
        if (fonte === "demo") {
          setEstoque((atual) => alternarCategoriaDaSecao(atual, codigo, categoriaId));
          return;
        }
        if (!conexaoRealPronta) { avisar("Conexão indisponível. Atualize os dados antes de editar."); return; }
        const local = estoque.locais?.find((item) => item.codigo === codigo);
        if (!local) { avisar("Local não encontrado."); return; }
        try {
          const resposta = adicionar
            ? await estoqueApi.vincularCategoriaLocal(local.id, categoriaId)
            : await estoqueApi.desvincularCategoriaLocal(local.id, categoriaId);
          if (!resposta.success) throw new Error(resposta.error || "Não foi possível atualizar categorias.");
          setReloadKey((valor) => valor + 1);
          avisar("Categorias da prateleira atualizadas.");
        } catch (erro) { avisar(erro instanceof Error ? erro.message : "Falha ao atualizar categorias."); }
      }} onDefinirPrioridade={async (codigo, categoriaId, prioridade) => {
        if (!conexaoRealPronta) { avisar("Conexão indisponível. Atualize os dados antes de editar."); return; }
        const local = estoque.locais?.find((item) => item.codigo === codigo);
        if (!local) { avisar("Local não encontrado."); return; }
        const resposta = await organizacaoApi.definirPrioridadeCategoria(local.id, categoriaId, prioridade).catch(() => null);
        if (!resposta?.success) { avisar(resposta?.error || "Não foi possível alterar a prioridade."); return; }
        setReloadKey((valor) => valor + 1);
        avisar("Prioridade da categoria atualizada.");
      }} />}
      {aba === "arquivados" && <section className="rounded-card border border-border-default bg-surface-card p-5"><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Histórico preservado</p><h2 className="mt-1 text-xl font-semibold">{fonte === "real" ? "Unidades fora do ativo" : "Itens arquivados"}</h2><p className="mt-1 text-sm text-text-muted">Arquivar tira do estoque ativo, mas não apaga a rastreabilidade. Vendas aparecem aqui só para consulta.</p><div className="mt-4">{campoBusca}</div><div className="mt-4 space-y-2"><AnimatePresence initial={false}>{arquivados.map((unidade) => <motion.div layout key={unidade.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 12 }} className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border-default p-3"><button type="button" onClick={() => setUnidadeDetalhando(unidade)} aria-label={`Ver ficha de ${unidade.sku}`} className="min-w-0 flex-1 rounded-control text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"><strong>{unidade.sku}</strong><p className="mt-1 text-xs text-text-muted">{pecaPorId(unidade.pecaId)?.nome} · {unidade.vendidaEm ? "Vendida" : unidade.motivoArquivamento ?? "Arquivada"}</p></button>{!unidade.vendidaEm && podeAlterar && <button type="button" aria-label={`Restaurar ${unidade.sku}`} disabled={restaurando === unidade.id} onClick={() => void restaurar(unidade)} className={botaoSecundario}>{restaurando === unidade.id ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}Restaurar</button>}</motion.div>)}</AnimatePresence>{!arquivados.length && <p className="rounded-control border border-dashed border-border-default p-6 text-center text-sm text-text-muted">Nenhuma unidade fora do ativo.</p>}</div></section>}
      </motion.div></AnimatePresence>}
    </main>
    <InventoryComposer aberto={composerAberto} pecaInicialId={pecaParaUnidade} categorias={estoque.categorias} pecas={estoque.pecas} enderecos={fonte === "real" ? enderecosReais : undefined} operacional={fonte === "real"} onFechar={() => { setComposerAberto(false); setPecaParaUnidade(null); }} onDescartarFotos={(urls) => { if (fonte === "real") void organizacaoApi.descartarFotos(urls).catch(() => undefined); }} onSalvar={async (entrada, cacheFotos) => {
      if (fonte === "demo") {
        setEstoque((atual) => adicionarUnidade(atual, entrada));
        avisar("Unidade adicionada à demonstração local");
        return;
      }
      if (!conexaoRealPronta) throw new Error("Conexão indisponível. Atualize o estoque e confira se o cadastro já foi salvo antes de tentar novamente.");
      const resultado = await salvarUnidadeOperacional(entrada, estoque.pecas, estoque.locais ?? [], cacheFotos);
      setReloadKey((valor) => valor + 1);
      avisar(resultado.mensagem);
      return resultado;
    }} />
    <InventoryPieceSummaryDrawer resultado={resultadoResumo} onClose={() => setPecaResumoId(null)} onOpenUnit={(unidade) => { setPecaResumoId(null); setUnidadeDetalhando(unidade); }} />
    <InventoryUnitDrawer unidade={unidadeAberta} peca={unidadeAberta ? pecaPorId(unidadeAberta.pecaId) : null} reservasHabilitadas={conexaoPermiteGravar} podeAlterar={podeAlterar} recursos={fonte === "real" ? recursos : RECURSOS_DEMONSTRACAO} clientes={fonte === "real" ? clientesReais : clientesDemo} formasPagamento={fonte === "real" ? formasReais : formasDemo} onReservar={reservar} onLiberarReserva={liberarReserva} carregarHistorico={carregarHistorico} abrirEmEdicao={Boolean(unidadeEditando)} operacional={fonte === "real"} podeArquivar={podeAlterar} enderecos={fonte === "real" ? enderecosReais : undefined} onFechar={() => { setUnidadeDetalhando(null); setUnidadeEditando(null); }} onSalvar={salvarEdicao} onArquivar={() => { const unidade = unidadeDetalhando ?? unidadeEditando; if (unidade) abrirArquivamento(unidade); setUnidadeDetalhando(null); setUnidadeEditando(null); }} />
    <InventoryDialog isOpen={Boolean(archiveTarget)} onClose={() => { if (!processando) setArchiveTarget(null); }} eyebrow="Arquivar unidade" title={archiveTarget ? `Retirar ${archiveTarget.sku} do ativo?` : "Arquivar unidade"} description="Ela sai dos resultados, do mapa e da quantidade da peça, mas o histórico permanece e ela pode ser restaurada na aba Arquivados."
      footer={<><button type="button" disabled={processando} onClick={() => setArchiveTarget(null)} className={`${buttonBase} text-text-secondary hover:bg-surface-inset`}>Cancelar</button><button type="button" disabled={processando || !motivoValido} onClick={() => void arquivar()} className={`${buttonBase} bg-danger text-white hover:opacity-90`}>{processando ? <Loader2 size={16} className="animate-spin" /> : <Archive size={16} />}Confirmar arquivamento</button></>}>
      <label className="mt-4 block text-sm font-semibold text-text-secondary">Motivo {fonte === "real" ? <span className="font-normal text-text-faint">(obrigatório, 3 a 240 caracteres)</span> : <span className="font-normal text-text-faint">(opcional na demonstração)</span>}<textarea aria-label="Motivo do arquivamento" rows={3} maxLength={240} value={motivoArquivamento} onChange={(event) => setMotivoArquivamento(event.target.value)} placeholder="Ex.: peça danificada no galpão, cadastro duplicado" className="mt-1 w-full rounded-control border border-border-default bg-surface-inset px-3 py-2 font-normal text-base text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm" /></label>
    </InventoryDialog>
    <InventoryConferencia aberto={conferenciaAberta} onFechar={() => setConferenciaAberta(false)} baixas={baixasPendentes} sobras={sobras} pecas={estoque.pecas} unidades={estoque.unidades} podeAlterar={podeAlterar} onConferir={conferirBaixa} onBaixarExcedente={baixarFichaExcedente} />
  </div></InventoryTokensContext.Provider>;
}
