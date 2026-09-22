import {
  Archive,
  LayoutGrid,
  List,
  MapPin,
  MoreHorizontal,
  PackagePlus,
  RotateCcw,
  Search,
  Tag,
  X,
} from "lucide-react";
import { animate } from "animejs";
import { DotMatrix } from "dot-anime-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart } from "@/src/components/charts/area-chart";
import { Grid } from "@/src/components/charts/grid";
import { XAxis } from "@/src/components/charts/x-axis";
import { Tabs, TabsContent, TabsContents, TabsList, TabsTrigger } from "@/src/components/animate-ui/components/animate/tabs";
import { categoriasApi } from "../../lib/catalogApi";
import { estoqueApi } from "../estoque/api";
import { adaptarEstoqueReal } from "./realInventoryAdapter";
import { InventoryComposer } from "./InventoryComposer";
import { InventoryUnitDrawer } from "./InventoryUnitDrawer";
import {
  adicionarUnidade,
  arquivarUnidade,
  buscarPecas,
  criarEstoqueDemo,
  definirCategoriaDaSecao,
  editarUnidade,
  getMetricas,
  getSecoesDaPrateleira,
  restaurarUnidade,
  type CategoriaEstoque,
  type EstoquePreviewState,
  type PecaEstoque,
  type UnidadeEstoque,
} from "./inventoryPreviewModel";

type Aba = "atendimento" | "organizar" | "mapa" | "arquivados";
type Visualizacao = "cards" | "lista";

const buttonBase = "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-blue-100";
const ritmoOrganizacao = [
  { date: "2026-09-18", organizadas: 2 },
  { date: "2026-09-19", organizadas: 4 },
  { date: "2026-09-20", organizadas: 3 },
  { date: "2026-09-21", organizadas: 6 },
  { date: "2026-09-22", organizadas: 5 },
];

function moeda(valor: number | null) {
  return valor === null ? "Preço a definir" : valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function diasRestantes(data: string) {
  const dias = Math.ceil((new Date(data).getTime() - Date.now()) / 86400000);
  return Math.max(0, dias);
}

function estadoLabel(unidade: UnidadeEstoque) {
  if (unidade.estado === "reservada") return `Reservada · ${diasRestantes(unidade.reservadaAte ?? "")} dias restantes`;
  if (unidade.estado === "organizar" || !unidade.endereco) return "Organizar";
  return "Disponível";
}

function estadoClass(unidade: UnidadeEstoque) {
  if (unidade.estado === "reservada") return "bg-blue-50 text-blue-800";
  if (unidade.estado === "organizar" || !unidade.endereco) return "bg-violet-50 text-violet-800";
  return "bg-emerald-50 text-emerald-800";
}

function ActionMenu({ unidade, onEdit, onArchive }: { unidade: UnidadeEstoque; onEdit: () => void; onArchive: () => void }) {
  const [aberto, setAberto] = useState(false);
  return <div className="relative">
    <button type="button" aria-label={`Ações de ${unidade.sku}`} onClick={() => setAberto((valor) => !valor)} className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><MoreHorizontal size={18} /></button>
    {aberto && <div role="menu" className="absolute right-0 top-10 z-20 min-w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
      <button type="button" role="menuitem" onClick={() => { setAberto(false); onEdit(); }} className="block w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50">Editar unidade</button>
      <button type="button" role="menuitem" onClick={() => { setAberto(false); onArchive(); }} className="block w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50">Arquivar unidade</button>
    </div>}
  </div>;
}

function UnitRow({ unidade, peca, onOpen, onEdit, onArchive }: { unidade: UnidadeEstoque; peca: PecaEstoque; onOpen: () => void; onEdit: () => void; onArchive: () => void }) {
  return <div className="relative flex min-h-36 w-[min(19rem,86vw)] shrink-0 snap-start flex-col rounded-control border border-border-default bg-surface-card p-3 shadow-elevated-sm transition hover:border-accent/35 hover:shadow-elevated-md">
    <div className="flex items-start gap-3">
      <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-control border border-dashed border-border-default bg-surface-inset text-center text-[10px] font-semibold text-text-faint">{unidade.fotoUrl ? <img src={unidade.fotoUrl} alt={`Foto ${unidade.sku}`} className="h-full w-full object-cover" /> : "Sem foto"}</div>
      <button type="button" aria-label={`Ver detalhes de ${unidade.sku}`} onClick={onOpen} className="min-w-0 flex-1 cursor-pointer text-left focus:outline-none focus:ring-4 focus:ring-accent/20">
        <div className="flex flex-wrap items-center gap-1.5"><strong className="text-sm text-text-primary">{unidade.sku}</strong><span className="rounded-full bg-surface-inset px-2 py-0.5 text-[10px] font-semibold text-text-secondary">Grau {unidade.grau}</span></div>
        <p className="mt-1 text-sm font-semibold text-text-primary">{moeda(unidade.preco)}</p>
        <p className="mt-1 truncate text-xs text-text-muted">{unidade.endereco ?? "Sem endereço"} · {unidade.origem ?? "Origem não identificada"}</p>
      </button>
      <ActionMenu unidade={unidade} onEdit={onEdit} onArchive={onArchive} />
    </div>
    <span className={`mt-auto w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${estadoClass(unidade)}`}>{estadoLabel(unidade)}</span>
  </div>;
}

function PieceCard({ resultado, onOpen, onEdit, onArchive }: { resultado: ReturnType<typeof buscarPecas>[number]; onOpen: (unidade: UnidadeEstoque) => void; onEdit: (unidade: UnidadeEstoque) => void; onArchive: (unidade: UnidadeEstoque) => void }) {
  const temMaisUnidades = resultado.unidades.length > 3;
  return <article className="overflow-hidden rounded-xl border border-border-default bg-surface-card p-4 shadow-elevated-sm">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-[.12em] text-blue-600">{resultado.categoria.nome} · {resultado.peca.codigoLegado}</p><h3 className="mt-1 text-base font-bold text-slate-900">{resultado.peca.nome}</h3><p className="mt-1 text-xs text-slate-500">{resultado.peca.compatibilidades.join(" · ") || "Moto não informada"}</p></div>
      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{resultado.unidades.length} {resultado.unidades.length === 1 ? "unidade" : "unidades"}</span>
    </div>
    <div className="relative mt-4">
      <div aria-label={`Unidades de ${resultado.peca.codigoLegado}`} className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 pr-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{resultado.unidades.map((unidade) => <UnitRow key={unidade.id} unidade={unidade} peca={resultado.peca} onOpen={() => onOpen(unidade)} onEdit={() => onEdit(unidade)} onArchive={() => onArchive(unidade)} />)}</div>
      {temMaisUnidades && <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-surface-card via-surface-card/85 to-transparent" />}
    </div>
  </article>;
}

function Metric({ label, value, helper, tone = "slate" }: { label: string; value: string; helper: string; tone?: "slate" | "blue" | "violet" }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = animate(ref.current, { opacity: [0.72, 1], translateY: [6, 0], duration: 280, ease: "out(3)" });
    return () => {
      animation.pause();
    };
  }, [value]);
  const colors = { slate: "border-slate-200", blue: "border-blue-200", violet: "border-violet-200" };
  const dots = { slate: "bg-slate-400", blue: "bg-blue-500", violet: "bg-violet-500" };
  return <div ref={ref} className={`relative min-h-32 rounded-xl border bg-white p-4 ${colors[tone]}`}><span aria-hidden="true" className={`absolute right-4 top-5 size-1.5 rounded-full ${dots[tone]}`} /><p className="text-[11px] font-bold uppercase tracking-[.12em] text-slate-400">{label}</p><p className="mt-2 text-3xl font-bold tracking-[-.055em] text-slate-950">{value}</p><p className="mt-2 text-xs leading-5 text-slate-500"><span className={`mr-1 inline-block size-1 rounded-full ${dots[tone]}`} />{helper}</p></div>;
}

function StockRhythmCard() {
  return <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,.04)]"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[.12em] text-slate-400">Ritmo de organização</p><h3 className="mt-1 text-base font-bold text-slate-900">Unidades conferidas no turno</h3></div><span className="mt-1 size-2 rounded-full bg-emerald-500" /></div><div className="mt-4 h-28"><AreaChart data={ritmoOrganizacao} aspectRatio="auto" style={{ height: 112 }} animationDuration={500}><Grid horizontal stroke="rgba(148,163,184,.2)" hideHorizontalEdgeLines /><Area dataKey="organizadas" fill="#2563eb" fillOpacity={0.12} stroke="#2563eb" strokeWidth={2} fadeEdges /><XAxis numTicks={3} /></AreaChart></div><p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">Use este gráfico para enxergar se a fila “Para organizar” está diminuindo, não como decoração.</p></section>;
}

function SectionEditor({ categorias, atual, onEscolher, onFechar }: { categorias: CategoriaEstoque[]; atual: CategoriaEstoque | null; onEscolher: (id: string | null) => void; onFechar: () => void }) {
  return <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3"><span className="mr-1 text-xs font-bold text-blue-900">Categoria:</span>{categorias.map((categoria) => <button key={categoria.id} type="button" aria-label={`Categoria: ${categoria.nome}`} onClick={() => onEscolher(categoria.id)} className={`rounded-lg px-3 py-2 text-xs font-bold ${atual?.id === categoria.id ? "bg-blue-600 text-white" : "bg-white text-slate-700 hover:bg-blue-100"}`}>{categoria.nome}</button>)}{atual && <button type="button" onClick={() => onEscolher(null)} className="rounded-lg px-3 py-2 text-xs text-slate-600 hover:bg-white">Limpar</button>}<button type="button" onClick={onFechar} className="ml-auto rounded-lg p-2 text-slate-500 hover:bg-white" aria-label="Fechar edição da categoria"><X size={15} /></button></div>;
}

export function EstoquePreview() {
  const [estoque, setEstoque] = useState<EstoquePreviewState>(criarEstoqueDemo);
  const [fonte, setFonte] = useState<"demo" | "real">("demo");
  const [carregandoReal, setCarregandoReal] = useState(true);
  const [erroReal, setErroReal] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("atendimento");
  const [busca, setBusca] = useState("");
  const [visualizacao, setVisualizacao] = useState<Visualizacao>("cards");
  const [composerAberto, setComposerAberto] = useState(false);
  const [unidadeDetalhando, setUnidadeDetalhando] = useState<UnidadeEstoque | null>(null);
  const [unidadeEditando, setUnidadeEditando] = useState<UnidadeEstoque | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<UnidadeEstoque | null>(null);
  const [prateleira, setPrateleira] = useState("P01");
  const [secaoEditando, setSecaoEditando] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const metricas = getMetricas(estoque);
  const resultados = useMemo(() => buscarPecas(estoque, busca), [estoque, busca]);
  const arquivados = useMemo(() => estoque.unidades.filter((unidade) => unidade.estado === "arquivada" && (!busca || buscarPecas(estoque, busca, true).some((item) => item.unidades.some((candidato) => candidato.id === unidade.id)))), [estoque, busca]);
  const triagem = estoque.unidades.filter((unidade) => unidade.estado === "organizar" || !unidade.endereco);
  const secoes = getSecoesDaPrateleira(estoque, prateleira);
  const pecaPorId = (id: string) => estoque.pecas.find((peca) => peca.id === id) ?? null;

  useEffect(() => {
    let ativo = true;
    async function carregarEstoqueReal() {
      try {
        const [estoqueResposta, categoriasResposta] = await Promise.all([
          estoqueApi.listar(),
          categoriasApi.listar(),
        ]);
        if (!estoqueResposta.success) throw new Error(estoqueResposta.error || "Não foi possível carregar o estoque");
        if (!categoriasResposta.success) throw new Error(categoriasResposta.error || "Não foi possível carregar as categorias");
        if (!ativo) return;
        setEstoque(adaptarEstoqueReal(estoqueResposta.data ?? [], categoriasResposta.data ?? []));
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
  }, []);

  function avisar(mensagem: string) {
    setToast(mensagem);
    window.setTimeout(() => setToast(null), 2600);
  }

  function salvarEdicao(alteracoes: Partial<Pick<UnidadeEstoque, "preco" | "grau" | "origem" | "endereco">>) {
    const unidade = unidadeEditando ?? unidadeDetalhando;
    if (!unidade) return;
    setEstoque((atual) => editarUnidade(atual, unidade.id, alteracoes));
    setUnidadeDetalhando(null);
    setUnidadeEditando(null);
    avisar(fonte === "real" ? "Alteração aplicada apenas nesta prévia" : "Unidade atualizada");
  }

  function arquivar() {
    if (!archiveTarget) return;
    setEstoque((atual) => arquivarUnidade(atual, archiveTarget.id, "Arquivada pela equipe"));
    setArchiveTarget(null);
    avisar(fonte === "real" ? "Arquivamento aplicado apenas nesta prévia" : "Unidade arquivada · histórico preservado");
  }

  return <main className="min-h-[100dvh] bg-[#f7f9fc] font-[Geist,Inter,ui-sans-serif,system-ui,sans-serif] text-slate-900 [&_button]:cursor-pointer">
    <div className="mx-auto max-w-[1480px] px-4 py-4 sm:px-7 sm:py-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-xs font-black text-white">RK</span><div><span className="block text-sm font-bold text-slate-800">RK Sucatas</span><span className="block text-[10px] font-semibold uppercase tracking-[.12em] text-slate-400">Estoque · sistema integrado</span></div><span className={`hidden rounded-full px-2 py-1 text-xs font-semibold sm:inline ${fonte === "real" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>{fonte === "real" ? "Dados reais · simulação local" : "Demonstração local"}</span></div><div className="flex items-center gap-3"><span className="hidden items-center gap-2 text-xs font-medium text-slate-500 lg:inline-flex"><DotMatrix sequence={[[0, 1, 2, 4, 6, 8, 10, 12, 14], [1, 4, 7, 10, 13]]} rows={4} cols={4} dotSize={3} gap={2} interval={900} color="#2563eb" inactiveColor="rgba(37,99,235,.14)" />Sincronizado</span><button type="button" aria-label="Nova peça" onClick={() => setComposerAberto(true)} className={`${buttonBase} bg-blue-600 text-white shadow-sm hover:bg-blue-700`}><PackagePlus size={17} />Nova peça</button></div></header>
      <section className="py-6 sm:py-8"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-[11px] font-bold uppercase tracking-[.14em] text-slate-500">Operação do galpão · atendimento e organização</p><h1 className="mt-2 text-[clamp(2rem,4vw,3rem)] font-bold tracking-[-.055em]">Estoque</h1><p className="mt-1 max-w-2xl text-sm text-slate-500">Peça é o nome que você busca. Unidade é a peça física, com seu próprio preço, foto, estado e endereço.</p></div><label className="relative block w-full sm:w-[360px]"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input aria-label="Buscar no estoque" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar peça, moto, SKU ou endereço" className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></label></div></section>
      {toast && <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-800 shadow-lg">{toast}</div>}
      {carregandoReal && <div role="status" className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">Carregando categorias e itens reais do estoque…</div>}
      {!carregandoReal && fonte === "real" && <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"><strong>Você está vendo o estoque real.</strong> Esta preview não altera cadastros. Os itens sem endereço aparecem em “Organizar” para serem classificados quando o método físico for validado.</div>}
      {!carregandoReal && fonte === "demo" && <div role="alert" className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"><strong>Dados demonstrativos.</strong> Não foi possível carregar o estoque real{erroReal ? `: ${erroReal}` : "."} Nenhuma alteração nesta tela será persistida.</div>}
      <Tabs value={aba} onValueChange={(valor) => setAba(valor as Aba)} className="gap-0">
        <TabsList variant="underline" aria-label="Visões do estoque" className="w-full justify-start overflow-x-auto px-0">
          {([["atendimento", "Atendimento", metricas.totalAtivas], ["organizar", "Organizar", metricas.paraOrganizar], ["mapa", "Mapa físico", 88], ["arquivados", "Arquivados", metricas.arquivadas]] as const).map(([id, nome, total]) => <TabsTrigger key={id} value={id} className="h-11 shrink-0 px-4 text-sm font-semibold">{nome}<span className="rounded-full bg-surface-inset px-1.5 py-0.5 text-[11px] text-text-muted">{total}</span></TabsTrigger>)}
        </TabsList>
        <TabsContents className="mt-5">
          <TabsContent value="atendimento">
      {aba === "atendimento" && <><section aria-label="Resumo operacional do estoque" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Estoque ativo" value={String(metricas.totalAtivas)} helper="unidades físicas no estoque" tone="blue" /><Metric label="Disponíveis" value={String(metricas.disponiveis)} helper="prontas para atender agora" tone="slate" /><Metric label="Reservadas" value={String(metricas.reservadas)} helper="20% de sinal · 7 dias" tone="blue" /><Metric label="Para organizar" value={String(metricas.paraOrganizar)} helper="sem endereço definitivo" tone="violet" /></section><div className="mt-6 flex items-center justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[.12em] text-slate-500">Catálogo unificado</p><h2 className="mt-1 text-lg font-bold">Peças por categoria</h2></div><div className="flex rounded-lg border border-slate-200 bg-white p-1"><button type="button" aria-label="Visualização em cartões" onClick={() => setVisualizacao("cards")} className={`rounded-md p-2 ${visualizacao === "cards" ? "bg-blue-50 text-blue-700" : "text-slate-400"}`}><LayoutGrid size={16} /></button><button type="button" aria-label="Visualização em lista" onClick={() => setVisualizacao("lista")} className={`rounded-md p-2 ${visualizacao === "lista" ? "bg-blue-50 text-blue-700" : "text-slate-400"}`}><List size={16} /></button></div></div>{visualizacao === "cards" ? <div className="mt-3 grid gap-3 xl:grid-cols-2">{resultados.map((resultado) => <PieceCard key={resultado.peca.id} resultado={resultado} onOpen={setUnidadeDetalhando} onEdit={setUnidadeEditando} onArchive={setArchiveTarget} />)}</div> : <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white"><table role="table" className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[.08em] text-slate-500"><tr><th className="px-4 py-3">Unidade</th><th className="px-4 py-3">Peça / categoria</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Endereço</th><th className="px-4 py-3">Preço</th><th /></tr></thead><tbody>{resultados.flatMap((resultado) => resultado.unidades.map((unidade) => <tr key={unidade.id} className="border-b border-slate-100"><td className="px-4 py-3"><button type="button" aria-label={`Ver detalhes de ${unidade.sku}`} onClick={() => setUnidadeDetalhando(unidade)} className="font-bold text-slate-900 hover:text-blue-700">{unidade.sku}</button></td><td className="px-4 py-3"><strong className="block">{resultado.peca.nome}</strong><span className="text-xs text-slate-500">{resultado.categoria.nome}</span></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${estadoClass(unidade)}`}>{estadoLabel(unidade)}</span></td><td className="px-4 py-3 text-slate-600">{unidade.endereco ?? "—"}</td><td className="px-4 py-3 font-semibold">{moeda(unidade.preco)}</td><td className="px-4 py-3"><ActionMenu unidade={unidade} onEdit={() => setUnidadeEditando(unidade)} onArchive={() => setArchiveTarget(unidade)} /></td></tr>))}</tbody></table></div>}{!resultados.length && <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Nenhum item encontrado. Tente nome, categoria, moto, código ou endereço.</div>}<aside className="mt-6 grid gap-3 sm:grid-cols-3"><div className="border-l-4 border-blue-400 bg-white p-4"><p className="text-[11px] font-bold uppercase tracking-[.1em] text-slate-500">Reservas</p><p className="mt-1 text-sm font-bold">20% · 7 dias corridos</p><p className="mt-1 text-xs leading-5 text-slate-500">A unidade continua no endereço e mostra o tempo restante.</p></div><div className="border-l-4 border-blue-400 bg-white p-4"><p className="text-[11px] font-bold uppercase tracking-[.1em] text-slate-500">Origem</p><p className="mt-1 text-sm font-bold">Não identificada é válida</p><p className="mt-1 text-xs leading-5 text-slate-500">80% do legado pode entrar sem inventar a moto doadora.</p></div><div className="border-l-4 border-slate-300 bg-white p-4"><p className="text-[11px] font-bold uppercase tracking-[.1em] text-slate-500">Demonstração</p><p className="mt-1 text-sm font-bold">Endereços fictícios</p><p className="mt-1 text-xs leading-5 text-slate-500">O mapa prova o método; o preenchimento real vem na implantação.</p></div></aside></>}
          </TabsContent>
          <TabsContent value="organizar">
      {aba === "organizar" && <section className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-[11px] font-bold uppercase tracking-[.12em] text-violet-700">Fila operacional</p><h2 className="mt-1 text-xl font-bold">Peças para organizar</h2><p className="mt-1 text-sm text-slate-500">Escolha um endereço quando souber. Até lá, a unidade não some e não é ofertada por engano.</p><div className="mt-4 space-y-2">{triagem.map((unidade) => <div key={unidade.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"><div><strong>{unidade.sku}</strong><span className="ml-2 text-sm text-slate-600">{pecaPorId(unidade.pecaId)?.nome}</span><p className="mt-1 text-xs text-slate-500">{unidade.origem ?? "Origem não identificada"} · Sem endereço definitivo</p></div><button type="button" onClick={() => setUnidadeEditando(unidade)} className={`${buttonBase} border border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-700`}><MapPin size={15} />Definir endereço</button></div>)}</div></section>}
          </TabsContent>
          <TabsContent value="mapa">
      {aba === "mapa" && <section><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-[.12em] text-slate-500">Mapa físico · demonstração</p><h2 className="mt-1 text-xl font-bold">Organização por categoria e seção</h2><p className="mt-1 text-sm text-slate-500">11 prateleiras · 8 seções por prateleira. Visualize uma prateleira por vez.</p></div><div className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1">{Array.from({ length: 11 }, (_, indice) => `P${String(indice + 1).padStart(2, "0")}`).map((codigo) => <button type="button" key={codigo} onClick={() => setPrateleira(codigo)} className={`rounded-md px-3 py-2 text-xs font-bold ${prateleira === codigo ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>{codigo}</button>)}</div></div><div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white"><header className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><strong>Prateleira {prateleira}</strong><span className="text-xs text-slate-500">8 seções · categorias personalizáveis</span></header><div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">{secoes.map((secao) => <div key={secao.endereco} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between gap-2"><span className="text-[11px] font-bold tracking-[.1em] text-slate-500">{secao.endereco}</span><button type="button" aria-label={`Editar ${secao.endereco}`} onClick={() => setSecaoEditando(secao.endereco)} className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-blue-600"><Tag size={15} /></button></div><strong className="mt-4 block text-sm">{secao.categoria?.nome ?? "Categoria pronta para preencher"}</strong><span className="mt-1 block text-xs text-slate-500">{secao.unidades.length} {secao.unidades.length === 1 ? "unidade" : "unidades"}</span>{secao.unidades.slice(0, 3).map((unidade) => <span key={unidade.id} className="mt-2 block truncate rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">{unidade.sku}</span>)}{secaoEditando === secao.endereco && <SectionEditor categorias={estoque.categorias} atual={secao.categoria} onEscolher={(categoriaId) => { setEstoque((atual) => definirCategoriaDaSecao(atual, secao.endereco, categoriaId)); setSecaoEditando(null); avisar("Categoria da seção atualizada"); }} onFechar={() => setSecaoEditando(null)} />}</div>)}</div></div></section>}
          </TabsContent>
          <TabsContent value="arquivados">
      {aba === "arquivados" && <section className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-[11px] font-bold uppercase tracking-[.12em] text-slate-500">Histórico preservado</p><h2 className="mt-1 text-xl font-bold">Itens arquivados</h2><p className="mt-1 text-sm text-slate-500">Arquivar tira do estoque ativo, mas não apaga a rastreabilidade.</p><div className="mt-4 space-y-2">{arquivados.map((unidade) => <div key={unidade.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"><div><strong>{unidade.sku}</strong><p className="mt-1 text-xs text-slate-500">{pecaPorId(unidade.pecaId)?.nome} · {unidade.motivoArquivamento}</p></div><button type="button" aria-label={`Restaurar ${unidade.sku}`} onClick={() => { setEstoque((atual) => restaurarUnidade(atual, unidade.id)); avisar("Unidade restaurada"); }} className={`${buttonBase} border border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-700`}><RotateCcw size={15} />Restaurar</button></div>)}{!arquivados.length && <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Nenhuma unidade arquivada.</p>}</div></section>}
          </TabsContent>
        </TabsContents>
      </Tabs>
    </div>
    <InventoryComposer aberto={composerAberto} categorias={estoque.categorias} pecas={estoque.pecas} onFechar={() => setComposerAberto(false)} onSalvar={(entrada) => { setEstoque((atual) => adicionarUnidade(atual, entrada)); avisar(fonte === "real" ? "Peça criada apenas nesta prévia" : "Unidade adicionada ao estoque"); }} />
    <InventoryUnitDrawer unidade={unidadeDetalhando ?? unidadeEditando} peca={unidadeDetalhando || unidadeEditando ? pecaPorId((unidadeDetalhando ?? unidadeEditando)!.pecaId) : null} abrirEmEdicao={Boolean(unidadeEditando)} onFechar={() => { setUnidadeDetalhando(null); setUnidadeEditando(null); }} onSalvar={salvarEdicao} onArquivar={() => { const unidade = unidadeDetalhando ?? unidadeEditando; if (unidade) setArchiveTarget(unidade); setUnidadeDetalhando(null); setUnidadeEditando(null); }} />
    {archiveTarget && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4"><section role="dialog" aria-label="Confirmar arquivamento" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[.12em] text-rose-600">Arquivar unidade</p><h2 className="mt-1 text-xl font-bold">Retirar {archiveTarget.sku} do ativo?</h2></div><Archive className="text-rose-500" size={22} /></div><p className="mt-3 text-sm leading-6 text-slate-600">Ela sai dos resultados e do mapa, mas o histórico permanece disponível para restauração.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setArchiveTarget(null)} className={`${buttonBase} text-slate-600 hover:bg-slate-100`}>Cancelar</button><button type="button" onClick={arquivar} className={`${buttonBase} bg-rose-600 text-white hover:bg-rose-700`}>Confirmar arquivamento</button></div></section></div>}
    {aba === "atendimento" && <div className="mx-auto max-w-[1480px] px-4 pb-8 sm:px-7"><StockRhythmCard /></div>}
  </main>;
}
