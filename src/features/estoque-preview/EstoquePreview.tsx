import {
  Archive,
  LayoutGrid,
  List,
  MapPin,
  MoreHorizontal,
  PackagePlus,
  RotateCcw,
  Search,
} from "lucide-react";
import { DotMatrix } from "dot-anime-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { UIEvent } from "react";
import { Area, AreaChart } from "@/src/components/charts/area-chart";
import { Grid } from "@/src/components/charts/grid";
import { XAxis } from "@/src/components/charts/x-axis";
import { Tabs, TabsContent, TabsContents, TabsList, TabsTrigger } from "@/src/components/animate-ui/components/animate/tabs";
import { AnimatePresence, motion } from "motion/react";
import { categoriasApi } from "../../lib/catalogApi";
import { estoqueApi } from "../estoque/api";
import { clientesApi } from "../clientes/api";
import type { Cliente } from "../clientes/types";
import { adaptarEstoqueReal } from "./realInventoryAdapter";
import { salvarUnidadeOperacional } from "./persistInventory";
import { InventoryComposer } from "./InventoryComposer";
import { lightInventoryTokens } from "./InventoryDrawer";
import { InventoryUnitDrawer } from "./InventoryUnitDrawer";
import { InventoryMap } from "./InventoryMap";
import {
  adicionarUnidade,
  alternarCategoriaDaSecao,
  arquivarUnidade,
  buscarPecas,
  criarEstoqueDemo,
  diasRestantesReserva,
  editarUnidade,
  getMetricas,
  liberarReservaUnidade,
  reservarUnidade,
  restaurarUnidade,
  type EstoquePreviewState,
  type ReservaUnidadeInput,
  type PecaEstoque,
  type UnidadeEstoque,
} from "./inventoryPreviewModel";

type Aba = "atendimento" | "organizar" | "mapa" | "arquivados";
type Visualizacao = "cards" | "lista";

const buttonBase = "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-blue-100";

function moeda(valor: number | null) {
  return valor === null ? "Preço a definir" : valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function diasRestantes(data: string) {
  return diasRestantesReserva(data);
}

function estadoLabel(unidade: UnidadeEstoque) {
  if (unidade.vendidaEm) return "Vendida";
  if (unidade.estado === "arquivada") return "Arquivada";
  if (unidade.estado === "reservada") return `Reservada · ${diasRestantes(unidade.reservadaAte ?? "")} dias restantes`;
  if (unidade.estado === "organizar" || !unidade.endereco) return "Organizar";
  return "Disponível";
}

function estadoClass(unidade: UnidadeEstoque) {
  if (unidade.estado === "arquivada") return "bg-slate-100 text-slate-700";
  if (unidade.estado === "reservada") return "bg-blue-50 text-blue-800";
  if (unidade.estado === "organizar" || !unidade.endereco) return "bg-violet-50 text-violet-800";
  return "bg-emerald-50 text-emerald-800";
}

function ActionMenu({ unidade, onEdit, onArchive, podeArquivar }: { unidade: UnidadeEstoque; onEdit: () => void; onArchive: () => void; podeArquivar: boolean }) {
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    if (!aberto) return;
    const fecharComEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAberto(false);
    };
    document.addEventListener("keydown", fecharComEscape);
    return () => document.removeEventListener("keydown", fecharComEscape);
  }, [aberto]);
  if (unidade.individualizada === false) return <span className="text-[11px] text-slate-500">Sem ficha individual</span>;
  return <div className="relative">
    <button type="button" aria-label={`Ações de ${unidade.sku}`} aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto((valor) => !valor)} className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><MoreHorizontal size={18} /></button>
    {aberto && <div role="menu" className="absolute right-0 top-10 z-20 min-w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
      <button type="button" role="menuitem" onClick={() => { setAberto(false); onEdit(); }} className="block w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50">Editar unidade</button>
      {podeArquivar && <button type="button" role="menuitem" onClick={() => { setAberto(false); onArchive(); }} className="block w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50">Arquivar unidade</button>}
    </div>}
  </div>;
}

function UnitRow({ unidade, peca, onOpen, onEdit, onArchive, podeArquivar }: { unidade: UnidadeEstoque; peca: PecaEstoque; onOpen: () => void; onEdit: () => void; onArchive: () => void; podeArquivar: boolean }) {
  return <div className="relative flex min-h-36 w-[min(19rem,86vw)] shrink-0 snap-start flex-col rounded-control border border-border-default bg-surface-card p-3 shadow-elevated-sm transition hover:border-accent/35 hover:shadow-elevated-md">
    <div className="flex items-start gap-3">
      <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-control border border-dashed border-border-default bg-surface-inset text-center text-[10px] font-semibold text-text-faint">{unidade.fotoUrl ? <img src={unidade.fotoUrl} alt={`Foto ${unidade.sku}`} className="h-full w-full object-cover" /> : "Sem foto"}</div>
      <button type="button" aria-label={`Ver detalhes de ${unidade.sku}`} onClick={onOpen} className="min-w-0 flex-1 cursor-pointer text-left focus:outline-none focus:ring-4 focus:ring-accent/20">
        <div className="flex flex-wrap items-center gap-1.5"><strong className="text-sm text-text-primary">{unidade.sku}</strong><span className="rounded-full bg-surface-inset px-2 py-0.5 text-[10px] font-semibold text-text-secondary">Grau {unidade.grau}</span></div>
        <p className="mt-1 text-sm font-semibold text-text-primary">{moeda(unidade.preco)}</p>
        <p className="mt-1 truncate text-xs text-text-muted">{unidade.endereco ?? "Sem endereço"} · {unidade.origem ?? "Origem não identificada"}</p>
      </button>
      <ActionMenu unidade={unidade} onEdit={onEdit} onArchive={onArchive} podeArquivar={podeArquivar} />
    </div>
    <span className={`mt-auto w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${estadoClass(unidade)}`}>{estadoLabel(unidade)}</span>
  </div>;
}

function PieceCard({ resultado, onOpen, onEdit, onArchive, podeArquivar }: { resultado: ReturnType<typeof buscarPecas>[number]; onOpen: (unidade: UnidadeEstoque) => void; onEdit: (unidade: UnidadeEstoque) => void; onArchive: (unidade: UnidadeEstoque) => void; podeArquivar: boolean }) {
  const temMaisUnidades = resultado.unidades.length > 3;
  const semEstoque = resultado.unidades.length === 0;
  const semFicha = resultado.unidades.filter((unidade) => unidade.individualizada === false).length;
  return <article className={`overflow-hidden rounded-xl border bg-surface-card p-4 shadow-elevated-sm ${semEstoque ? "border-amber-300 bg-amber-50/35" : "border-border-default"}`}>
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-[.12em] text-blue-600">{resultado.categoria.nome} · {resultado.peca.codigoLegado}</p><h3 className="mt-1 text-base font-bold text-slate-900">{resultado.peca.nome}</h3><p className="mt-1 text-xs text-slate-500">{resultado.peca.compatibilidades.join(" · ") || "Moto não informada"}</p></div>
      <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${semEstoque ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{semEstoque ? "Sem estoque" : `${resultado.unidades.length} ${resultado.unidades.length === 1 ? "unidade" : "unidades"}${semFicha ? ` · ${semFicha} sem ficha` : ""}`}</span>
    </div>
    <div className="relative mt-4">
      <div aria-label={`Unidades de ${resultado.peca.codigoLegado}`} className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 pr-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{semEstoque ? <div className="flex min-h-24 w-full items-center rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 text-sm text-amber-900"><strong>0 unidades físicas.</strong><span className="ml-1">Cadastre ou vincule uma unidade para liberar este item.</span></div> : resultado.unidades.map((unidade) => <UnitRow key={unidade.id} unidade={unidade} peca={resultado.peca} onOpen={() => onOpen(unidade)} onEdit={() => onEdit(unidade)} onArchive={() => onArchive(unidade)} podeArquivar={podeArquivar} />)}</div>
      {temMaisUnidades && <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-surface-card via-surface-card/85 to-transparent" />}
    </div>
  </article>;
}

function InventoryMetricStrip({ metricas }: { metricas: ReturnType<typeof getMetricas> }) {
  const metrics = [
    { label: "Valor em estoque", value: moeda(metricas.valorEmEstoque), suffix: `${metricas.unidadesComPreco}/${metricas.totalAtivas} com preço`, detail: "unidades ativas, inclusive reservadas", tone: "blue" },
    { label: "Estoque ativo", value: String(metricas.totalAtivas), suffix: "unidades", detail: "inclui quantidades legadas sem ficha", tone: "blue" },
    { label: "Localizadas", value: String(metricas.disponiveis), suffix: "com endereço", detail: "confira preço e venda antes de atender", tone: "emerald" },
    { label: "Para organizar", value: String(metricas.paraOrganizar), suffix: "na fila", detail: "sem endereço definitivo", tone: "violet" },
  ] as const;
  const scrollRef = useRef<HTMLElement | null>(null);
  const [scrollState, setScrollState] = useState({ isScrollable: false, canScrollLeft: false, canScrollRight: false });
  const updateScrollState = () => {
    const element = scrollRef.current;
    if (!element) return;
    const maxScroll = element.scrollWidth - element.clientWidth;
    setScrollState({ isScrollable: maxScroll > 2, canScrollLeft: element.scrollLeft > 2, canScrollRight: element.scrollLeft < maxScroll - 2 });
  };
  useEffect(() => {
    updateScrollState();
    window.addEventListener("resize", updateScrollState);
    return () => window.removeEventListener("resize", updateScrollState);
  }, []);
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      const maxScroll = element.scrollWidth - element.clientWidth;
      if (maxScroll <= 1) return;
      const atStart = element.scrollLeft <= 0;
      const atEnd = element.scrollLeft >= maxScroll - 1;
      if ((event.deltaY < 0 && atStart) || (event.deltaY > 0 && atEnd)) return;
      event.preventDefault();
      element.scrollLeft += event.deltaY;
    };
    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, []);
  const toneClasses = { blue: "border-slate-200 text-blue-700 bg-blue-500", emerald: "border-slate-200 text-emerald-700 bg-emerald-500", amber: "border-amber-200 text-amber-700 bg-amber-500", violet: "border-violet-200 text-violet-700 bg-violet-500" };
  return <div className="relative mt-6"><section ref={scrollRef} onScroll={updateScrollState} aria-label="Resumo operacional do estoque" className="no-scrollbar snap-x snap-mandatory overflow-x-auto scroll-smooth"><div className="grid min-w-[920px] grid-cols-4 gap-3">{metrics.map((metric) => { const tone = toneClasses[metric.tone]; return <motion.div key={metric.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 340, damping: 31, bounce: 0 }} className={`min-h-[132px] snap-start rounded-lg border bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${tone.split(" ")[0]}`}><div className="flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-[.12em] text-slate-400">{metric.label}</p><span className={`size-1.5 rounded-full ${tone.split(" ")[2]}`} aria-hidden="true" /></div><div className="mt-3 flex items-baseline gap-2"><p className="text-[28px] font-semibold leading-none tracking-[-.05em] text-slate-900">{metric.value}</p><span className="font-mono text-[11px] text-slate-500">{metric.suffix}</span></div><p className={`mt-3 text-[11px] leading-snug ${tone.split(" ")[1]}`}><span className={`mr-1 inline-block size-1.5 rounded-full ${tone.split(" ")[2]}`} />{metric.detail}</p></motion.div>; })}</div></section>{scrollState.isScrollable && <><div aria-hidden="true" className={`pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#f7f9fc] to-transparent transition-opacity ${scrollState.canScrollLeft ? "opacity-100" : "opacity-0"}`} /><div aria-hidden="true" className={`pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#f7f9fc] to-transparent transition-opacity ${scrollState.canScrollRight ? "opacity-100" : "opacity-0"}`} /></>}<span className="sr-only">Use a rolagem horizontal para ver todos os indicadores do estoque.</span></div>;
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
  return <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,.04)]"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[.12em] text-slate-400">Ritmo de organização</p><h3 className="mt-1 text-base font-bold text-slate-900">Unidades conferidas nos últimos 7 dias</h3></div><span className="mt-1 size-2 rounded-full bg-emerald-500" /></div>{total > 0 ? <div className="mt-4 h-28"><AreaChart data={ritmo} aspectRatio="auto" style={{ height: 112 }} animationDuration={500}><Grid horizontal stroke="rgba(148,163,184,.2)" hideHorizontalEdgeLines /><Area dataKey="organizadas" fill="#2563eb" fillOpacity={0.12} stroke="#2563eb" strokeWidth={2} fadeEdges /><XAxis numTicks={3} /></AreaChart></div> : <p className="mt-4 rounded-lg border border-dashed border-slate-200 p-5 text-sm text-slate-500">Ainda não há endereços conferidos neste período.</p>}<p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">Conta unidades que receberam um endereço físico em cada dia. Mudanças anteriores à implantação não aparecem.</p></section>;
}

function StockListRow({ unidade, resultado, onOpen, onEdit, onArchive, podeArquivar }: { unidade: UnidadeEstoque | null; resultado: ReturnType<typeof buscarPecas>[number]; onOpen: (unidade: UnidadeEstoque) => void; onEdit: (unidade: UnidadeEstoque) => void; onArchive: (unidade: UnidadeEstoque) => void; podeArquivar: boolean }) {
  if (!unidade) return <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50/50 p-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-900">{resultado.peca.codigoLegado}</strong><span className="rounded border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">Sem estoque</span></div><p className="mt-1 truncate text-sm font-semibold text-slate-700">{resultado.peca.nome}</p><p className="mt-1 text-xs text-amber-800">0 unidades físicas cadastradas</p></div><span className="text-xs font-semibold text-amber-800">Adicionar unidade</span></motion.div>;
  return <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition hover:border-blue-200 hover:shadow-[0_8px_24px_rgba(15,23,42,.06)]"><button type="button" aria-label={`Ver detalhes de ${unidade.sku}`} onClick={() => onOpen(unidade)} className="min-w-0 flex-1 text-left"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-900">{unidade.sku}</strong><span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">{resultado.categoria.nome}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${estadoClass(unidade)}`}>{estadoLabel(unidade)}</span></div><p className="mt-1 truncate text-sm font-semibold text-slate-700">{resultado.peca.nome}</p><p className="mt-1 truncate text-xs text-slate-500">{unidade.endereco ?? "Sem endereço"} · {moeda(unidade.preco)}</p></button><ActionMenu unidade={unidade} onEdit={() => onEdit(unidade)} onArchive={() => onArchive(unidade)} podeArquivar={podeArquivar} /></motion.div>;
}

function InventoryCatalogViewport({ resultados, visualizacao, onOpen, onEdit, onArchive, podeArquivar }: { resultados: ReturnType<typeof buscarPecas>; visualizacao: Visualizacao; onOpen: (unidade: UnidadeEstoque) => void; onEdit: (unidade: UnidadeEstoque) => void; onArchive: (unidade: UnidadeEstoque) => void; podeArquivar: boolean }) {
  const [visibleCount, setVisibleCount] = useState(6);
  useEffect(() => setVisibleCount(6), [resultados]);
  const visibleResultados = resultados.slice(0, visibleCount);
  const unidades = visibleResultados.flatMap((resultado) => resultado.unidades.length ? resultado.unidades.map((unidade) => ({ unidade, resultado })) : [{ unidade: null, resultado }]);
  const hasMore = visibleCount < resultados.length;
  function carregarMais(event: UIEvent<HTMLDivElement>) {
    if (!hasMore) return;
    const element = event.currentTarget;
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - 120) setVisibleCount((count) => Math.min(count + 6, resultados.length));
  }
  return <section aria-label="Lista de itens do estoque" className="relative mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white"><div onScroll={carregarMais} tabIndex={0} className="no-scrollbar max-h-[min(68vh,720px)] overflow-y-auto overscroll-contain p-3 focus:outline-none focus:ring-4 focus:ring-blue-100"><AnimatePresence initial={false} mode="popLayout"><div className={visualizacao === "cards" ? "grid gap-3 xl:grid-cols-2" : "space-y-2"}>{visualizacao === "cards" ? visibleResultados.map((resultado) => <motion.div key={resultado.peca.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}><PieceCard resultado={resultado} onOpen={onOpen} onEdit={onEdit} onArchive={onArchive} podeArquivar={podeArquivar} /></motion.div>) : unidades.map(({ unidade, resultado }) => <StockListRow key={unidade?.id ?? resultado.peca.id} unidade={unidade} resultado={resultado} onOpen={onOpen} onEdit={onEdit} onArchive={onArchive} podeArquivar={podeArquivar} />)}</div></AnimatePresence>{!visibleResultados.length && <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Nenhum item encontrado. Tente nome, categoria, moto, código ou endereço.</div>}<div aria-live="polite" className="pt-3 text-center text-[11px] text-slate-400">{hasMore ? "Role para carregar mais itens" : "Todos os itens carregados"}</div></div><div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent" /></section>;
}

function clienteDemo(id: string, nome: string, telefone: string): Cliente {
  return { id, nome, telefone, documento: null, data_nascimento: null, origem: "balcao", preferencia_contato: "whatsapp", tags: [], observacoes: null, ativo: true, banido: false, cidade: null, estado: null, criado_em: "2026-09-01T12:00:00.000Z", atualizado_em: "2026-09-01T12:00:00.000Z" } as Cliente;
}
// Clientes fictícios só para a demonstração local exercitar o vínculo.
const clientesDemo: Cliente[] = [
  clienteDemo("cliente-demo-1", "Cliente demonstração A", "(83) 90000-0001"),
  clienteDemo("cliente-demo-2", "Cliente demonstração B", "(83) 90000-0002"),
];

export function EstoquePreview() {
  const [estoque, setEstoque] = useState<EstoquePreviewState>(criarEstoqueDemo);
  const [fonte, setFonte] = useState<"demo" | "real">("demo");
  const [carregandoReal, setCarregandoReal] = useState(true);
  const [erroReal, setErroReal] = useState<string | null>(null);
  const [erroOrganizacao, setErroOrganizacao] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [aba, setAba] = useState<Aba>("atendimento");
  const [busca, setBusca] = useState("");
  const [visualizacao, setVisualizacao] = useState<Visualizacao>("cards");
  const [composerAberto, setComposerAberto] = useState(false);
  const [unidadeDetalhando, setUnidadeDetalhando] = useState<UnidadeEstoque | null>(null);
  const [unidadeEditando, setUnidadeEditando] = useState<UnidadeEstoque | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<UnidadeEstoque | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [clientesReais, setClientesReais] = useState<Cliente[]>([]);
  const conexaoRealPronta = fonte === "real" && !carregandoReal && !erroReal && !erroOrganizacao;
  const podeAlterar = fonte === "demo" || conexaoRealPronta;
  const metricas = getMetricas(estoque);
  const resultados = useMemo(() => buscarPecas(estoque, busca), [estoque, busca]);
  const arquivados = useMemo(() => estoque.unidades.filter((unidade) => unidade.estado === "arquivada" && (!busca || buscarPecas(estoque, busca, true).some((item) => item.unidades.some((candidato) => candidato.id === unidade.id)))), [estoque, busca]);
  const triagem = estoque.unidades.filter((unidade) => unidade.estado !== "arquivada" && unidade.estado !== "reservada" && (unidade.estado === "organizar" || !unidade.endereco));
  const pecaPorId = (id: string) => estoque.pecas.find((peca) => peca.id === id) ?? null;
  // O drawer lê a unidade atualizada do estado (após reservar/liberar/recarregar),
  // não a cópia guardada no clique que o abriu.
  const unidadeSelecionada = unidadeDetalhando ?? unidadeEditando;
  const unidadeAberta = unidadeSelecionada ? estoque.unidades.find((item) => item.id === unidadeSelecionada.id) ?? unidadeSelecionada : null;

  useEffect(() => {
    let ativo = true;
    setCarregandoReal(true);
    async function carregarEstoqueReal() {
      try {
        const [estoqueResposta, categoriasResposta, organizacaoResposta] = await Promise.all([
          estoqueApi.listar(),
          categoriasApi.listar(),
          estoqueApi.listarOrganizacao().catch(() => null),
        ]);
        if (!estoqueResposta.success) throw new Error(estoqueResposta.error || "Não foi possível carregar o estoque");
        if (!categoriasResposta.success) throw new Error(categoriasResposta.error || "Não foi possível carregar as categorias");
        if (!ativo) return;
        const organizacao = organizacaoResposta?.success ? organizacaoResposta.data : null;
        setEstoque(adaptarEstoqueReal(estoqueResposta.data ?? [], categoriasResposta.data ?? [], organizacao?.locais ?? [], organizacao?.categorias ?? [], organizacao?.reservas ?? []));
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
    return () => { ativo = false; };
  }, [fonte, reloadKey]);

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
      const resposta = await estoqueApi.reservarUnidade(unidade.id, { clienteId: reserva.clienteId, responsavel: reserva.nome, reservadaAte: reserva.reservadaAte });
      if (!resposta.success) throw new Error(resposta.error || "Não foi possível reservar a unidade.");
      avisar(`Unidade reservada para ${resposta.data?.responsavel ?? reserva.nome}.`);
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

  function avisar(mensagem: string) {
    setToast(mensagem);
    window.setTimeout(() => setToast(null), 2600);
  }

  async function salvarEdicao(alteracoes: Partial<Pick<UnidadeEstoque, "preco" | "grau" | "origem" | "endereco">>) {
    const unidade = unidadeEditando ?? unidadeDetalhando;
    if (!unidade) return;
    if (fonte === "real") {
      if (!conexaoRealPronta) { avisar("Conexão indisponível. Atualize os dados antes de editar."); return; }
      if (unidade.individualizada === false) { avisar("Esta quantidade ainda não possui ficha física individual."); return; }
      const local = alteracoes.endereco ? estoque.locais?.find((item) => item.codigo === alteracoes.endereco && item.ativo) : null;
      if (alteracoes.endereco && !local) { avisar("Escolha um local cadastrado e ativo."); return; }
      try {
        const nota = alteracoes.grau === "A" ? 9 : alteracoes.grau === "C" ? 3 : 6;
        const resposta = await estoqueApi.atualizarUnidade(unidade.pecaId, unidade.id, { valor: alteracoes.preco ?? null, condicao_nota: nota });
        if (!resposta.success) throw new Error(resposta.error || "Não foi possível salvar a unidade.");
        const organizacao = await estoqueApi.organizarUnidade(unidade.id, { endereco_id: local?.id ?? null, origem_identificacao: alteracoes.origem ?? null });
        if (!organizacao.success) throw new Error(organizacao.error || "A ficha foi salva, mas o endereço precisa ser conferido.");
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

  function arquivar() {
    if (!archiveTarget) return;
    if (fonte === "real") {
      setArchiveTarget(null);
      avisar("Arquivamento de unidade real ainda não está habilitado nesta prévia.");
      return;
    }
    setEstoque((atual) => arquivarUnidade(atual, archiveTarget.id, "Arquivada pela equipe"));
    setArchiveTarget(null);
    avisar("Unidade arquivada na demonstração · histórico preservado");
  }

  return <main style={lightInventoryTokens} className="min-h-[100dvh] bg-[#f7f9fc] font-[Geist,Inter,ui-sans-serif,system-ui,sans-serif] text-slate-900 [&_button]:cursor-pointer">
    <div className="mx-auto max-w-[1480px] px-4 py-4 sm:px-7 sm:py-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-xs font-black text-white">RK</span><div><span className="block text-sm font-bold text-slate-800">RK Sucatas</span><span className="block text-[10px] font-semibold uppercase tracking-[.12em] text-slate-400">Estoque · sistema integrado</span></div><span className={`hidden rounded-full px-2 py-1 text-xs font-semibold sm:inline ${fonte === "real" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>{fonte === "real" ? "Dados reais · cadastro pela API" : "Demonstração local"}</span></div><div className="flex items-center gap-3"><span className="hidden items-center gap-2 text-xs font-medium text-slate-500 lg:inline-flex"><DotMatrix sequence={[[0, 1, 2, 4, 6, 8, 10, 12, 14], [1, 4, 7, 10, 13]]} rows={4} cols={4} dotSize={3} gap={2} interval={900} color="#2563eb" inactiveColor="rgba(37,99,235,.14)" />{carregandoReal ? "Conectando" : fonte === "real" ? "Dados carregados" : "Prévia local"}</span><button type="button" aria-label="Nova peça" disabled={!podeAlterar} onClick={() => setComposerAberto(true)} className={`${buttonBase} bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50`}><PackagePlus size={17} />Nova peça</button></div></header>
      <section className="py-6 sm:py-8"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-slate-500">Operação do galpão · atendimento e organização</p><h1 className="mt-2 text-[clamp(2rem,4vw,3rem)] font-bold tracking-[-.055em]">Estoque</h1><p className="mt-1 max-w-2xl text-sm text-slate-500">Peça é o nome que você busca. Unidade é a peça física, com seu próprio preço, foto, estado e endereço.</p></div><label className="relative block w-full sm:w-[360px]"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input aria-label="Buscar no estoque" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar peça, moto, SKU ou endereço" className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label></div></section>
      {toast && <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-800 shadow-lg">{toast}</div>}
      {carregandoReal && <div role="status" className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">Carregando categorias e itens reais do estoque…</div>}
      {!carregandoReal && fonte === "real" && <div role={conexaoRealPronta ? undefined : "alert"} className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"><strong>{conexaoRealPronta ? "Você está vendo o estoque real." : "Dados antigos em modo somente leitura."}</strong> {conexaoRealPronta ? "Cadastros e endereços salvos nesta tela são enviados à API." : `Não foi possível confirmar o estado atual: ${erroReal ?? erroOrganizacao}. Não faça alterações até reconectar.`} {!conexaoRealPronta && <button type="button" onClick={() => setReloadKey((valor) => valor + 1)} className="ml-2 rounded-lg border border-blue-300 px-2 py-1 font-semibold hover:bg-blue-100">Tentar novamente</button>}</div>}
      {!carregandoReal && fonte === "demo" && <div role="alert" className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"><strong>Dados demonstrativos.</strong> Não foi possível carregar o estoque real{erroReal ? `: ${erroReal}` : "."} Nenhuma alteração nesta tela será persistida.</div>}
      <Tabs value={aba} onValueChange={(valor) => setAba(valor as Aba)} className="gap-0">
        <TabsList variant="underline" aria-label="Visões do estoque" className="w-full justify-start overflow-x-auto px-0">
          {([["atendimento", "Atendimento", metricas.totalAtivas], ["organizar", "Organizar", metricas.paraOrganizar], ["mapa", "Mapa físico", fonte === "real" ? estoque.locais?.length ?? 0 : 88], ["arquivados", fonte === "real" ? "Fora do ativo" : "Arquivados", metricas.arquivadas]] as const).map(([id, nome, total]) => <TabsTrigger key={id} value={id} className="h-11 shrink-0 px-4 text-sm font-semibold">{nome}<span className="rounded-full bg-surface-inset px-1.5 py-0.5 text-[11px] text-text-muted">{total}</span></TabsTrigger>)}
        </TabsList>
        <TabsContents className="mt-5">
          <TabsContent value="atendimento">
      {aba === "atendimento" && <><InventoryMetricStrip metricas={metricas} /><div className="mt-6 flex items-center justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[.12em] text-slate-500">Catálogo unificado</p><h2 className="mt-1 text-lg font-bold">Peças por categoria</h2><p className="mt-1 text-xs text-slate-500">Role dentro do painel para carregar mais itens sem perder as estatísticas.</p></div><div className="flex rounded-lg border border-slate-200 bg-white p-1"><button type="button" aria-label="Visualização em cartões" onClick={() => setVisualizacao("cards")} className={`rounded-md p-2 ${visualizacao === "cards" ? "bg-blue-50 text-blue-700" : "text-slate-400"}`}><LayoutGrid size={16} /></button><button type="button" aria-label="Visualização em lista" onClick={() => setVisualizacao("lista")} className={`rounded-md p-2 ${visualizacao === "lista" ? "bg-blue-50 text-blue-700" : "text-slate-400"}`}><List size={16} /></button></div></div><InventoryCatalogViewport resultados={resultados} visualizacao={visualizacao} onOpen={setUnidadeDetalhando} onEdit={setUnidadeEditando} onArchive={setArchiveTarget} podeArquivar={fonte === "demo"} /><aside className="mt-6 grid gap-3 sm:grid-cols-3"><div className="border-l-4 border-blue-400 bg-white p-4"><p className="text-[11px] font-bold uppercase tracking-[.1em] text-slate-500">Preços conhecidos</p><p className="mt-1 text-sm font-bold">{metricas.unidadesComPreco} de {metricas.totalAtivas} unidades</p><p className="mt-1 text-xs leading-5 text-slate-500">O valor em estoque considera apenas preços definidos.</p></div><div className="border-l-4 border-blue-400 bg-white p-4"><p className="text-[11px] font-bold uppercase tracking-[.1em] text-slate-500">Origem</p><p className="mt-1 text-sm font-bold">Não identificada é válida</p><p className="mt-1 text-xs leading-5 text-slate-500">Não invente a moto doadora quando ela for desconhecida.</p></div><div className="border-l-4 border-slate-300 bg-white p-4"><p className="text-[11px] font-bold uppercase tracking-[.1em] text-slate-500">Endereços físicos</p><p className="mt-1 text-sm font-bold">{fonte === "real" ? `${estoque.locais?.length ?? 0} locais cadastrados` : "Endereços demonstrativos"}</p><p className="mt-1 text-xs leading-5 text-slate-500">Cadastre os locais reais no mapa antes de atribuí-los às unidades.</p></div></aside></>}
          </TabsContent>
          <TabsContent value="organizar">
      {aba === "organizar" && <section className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-[11px] font-bold uppercase tracking-[.12em] text-violet-700">Fila operacional</p><h2 className="mt-1 text-xl font-bold">Peças para organizar</h2><p className="mt-1 text-sm text-slate-500">Escolha um endereço quando souber. Unidades sem endereço continuam visíveis no catálogo para conferência; valide a disponibilidade antes de vender.</p><div className="mt-4 space-y-2">{triagem.map((unidade) => <div key={unidade.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"><div><strong>{unidade.sku}</strong><span className="ml-2 text-sm text-slate-600">{pecaPorId(unidade.pecaId)?.nome}</span><p className="mt-1 text-xs text-slate-500">{unidade.individualizada === false ? "Quantidade legada sem ficha individual" : unidade.origem ?? "Origem não identificada"} · Sem endereço definitivo</p></div>{unidade.individualizada === false ? <span className="text-xs text-slate-500">Individualização pendente</span> : <button type="button" onClick={() => setUnidadeEditando(unidade)} className={`${buttonBase} border border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-700`}><MapPin size={15} />Definir endereço</button>}</div>)}</div></section>}
          </TabsContent>
          <TabsContent value="mapa">
      {aba === "mapa" && <InventoryMap operacional={fonte === "real"} locais={estoque.locais ?? []} categorias={estoque.categorias} categoriasPorSecao={estoque.categoriasPorSecao} unidades={estoque.unidades} onCriarLocal={async (local) => {
        if (!conexaoRealPronta) throw new Error("Conexão indisponível. Atualize os dados antes de cadastrar locais.");
        const resposta = await estoqueApi.criarLocal(local);
        if (!resposta.success) throw new Error(resposta.error || "Não foi possível cadastrar o local.");
        setReloadKey((valor) => valor + 1);
        avisar("Local cadastrado.");
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
      }} />}
          </TabsContent>
          <TabsContent value="arquivados">
      {aba === "arquivados" && <section className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-[11px] font-bold uppercase tracking-[.12em] text-slate-500">Histórico preservado</p><h2 className="mt-1 text-xl font-bold">{fonte === "real" ? "Unidades fora do ativo" : "Itens arquivados"}</h2><p className="mt-1 text-sm text-slate-500">{fonte === "real" ? "Vendas e arquivamentos existentes são apenas consultados aqui." : "Arquivar tira do estoque ativo, mas não apaga a rastreabilidade."}</p><div className="mt-4 space-y-2">{arquivados.map((unidade) => <div key={unidade.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"><div><strong>{unidade.sku}</strong><p className="mt-1 text-xs text-slate-500">{pecaPorId(unidade.pecaId)?.nome} · {unidade.vendidaEm ? "Vendida" : unidade.motivoArquivamento ?? "Arquivada"}</p></div>{fonte === "demo" && <button type="button" aria-label={`Restaurar ${unidade.sku}`} onClick={() => { setEstoque((atual) => restaurarUnidade(atual, unidade.id)); avisar("Unidade restaurada"); }} className={`${buttonBase} border border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-700`}><RotateCcw size={15} />Restaurar</button>}</div>)}{!arquivados.length && <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Nenhuma unidade fora do ativo.</p>}</div></section>}
          </TabsContent>
        </TabsContents>
      </Tabs>
    </div>
    <InventoryComposer aberto={composerAberto} categorias={estoque.categorias} pecas={estoque.pecas} enderecos={fonte === "real" ? (estoque.locais ?? []).filter((local) => local.ativo).map((local) => ({ value: local.codigo, label: `${local.codigo} · ${local.deposito}, zona ${local.zona}, prateleira ${local.prateleira}, seção ${local.secao}` })) : undefined} operacional={fonte === "real"} onFechar={() => setComposerAberto(false)} onSalvar={async (entrada) => {
      if (fonte === "demo") {
        setEstoque((atual) => adicionarUnidade(atual, entrada));
        avisar("Unidade adicionada à demonstração local");
        return;
      }
      if (!conexaoRealPronta) throw new Error("Conexão indisponível. Atualize o estoque e confira se o cadastro já foi salvo antes de tentar novamente.");
      const resultado = await salvarUnidadeOperacional(entrada, estoque.pecas, estoque.locais ?? []);
      setReloadKey((valor) => valor + 1);
      avisar(resultado.mensagem);
      return resultado;
    }} />
    <InventoryUnitDrawer unidade={unidadeAberta} peca={unidadeAberta ? pecaPorId(unidadeAberta.pecaId) : null} reservasHabilitadas={podeAlterar} clientes={fonte === "real" ? clientesReais : clientesDemo} onReservar={reservar} onLiberarReserva={liberarReserva} abrirEmEdicao={Boolean(unidadeEditando)} operacional={fonte === "real"} podeArquivar={fonte === "demo"} enderecos={fonte === "real" ? (estoque.locais ?? []).filter((local) => local.ativo).map((local) => ({ value: local.codigo, label: `${local.codigo} · ${local.deposito}, zona ${local.zona}, prateleira ${local.prateleira}, seção ${local.secao}` })) : undefined} onFechar={() => { setUnidadeDetalhando(null); setUnidadeEditando(null); }} onSalvar={salvarEdicao} onArquivar={() => { const unidade = unidadeDetalhando ?? unidadeEditando; if (unidade) setArchiveTarget(unidade); setUnidadeDetalhando(null); setUnidadeEditando(null); }} />
    {archiveTarget && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-500/30 p-4"><section role="dialog" aria-label="Confirmar arquivamento" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[.12em] text-rose-600">Arquivar unidade</p><h2 className="mt-1 text-xl font-bold">Retirar {archiveTarget.sku} do ativo?</h2></div><Archive className="text-rose-500" size={22} /></div><p className="mt-3 text-sm leading-6 text-slate-600">Ela sai dos resultados e do mapa, mas o histórico permanece disponível para restauração.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setArchiveTarget(null)} className={`${buttonBase} text-slate-600 hover:bg-slate-100`}>Cancelar</button><button type="button" onClick={arquivar} className={`${buttonBase} bg-rose-600 text-white hover:bg-rose-700`}>Confirmar arquivamento</button></div></section></div>}
    {aba === "atendimento" && <div className="mx-auto max-w-[1480px] px-4 pb-8 sm:px-7"><StockRhythmCard unidades={estoque.unidades} /></div>}
  </main>;
}
