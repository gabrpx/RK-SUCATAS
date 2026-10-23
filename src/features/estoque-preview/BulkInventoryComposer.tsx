import { AnimatePresence, motion } from "motion/react";
import { Check, CheckCircle2, ImagePlus, ListPlus, Loader2, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Combobox } from "@/src/components/ui/Combobox";
import { EstoqueUploadFotos } from "../estoque/EstoqueUploadFotos";
import { encontrarCategoriaPorNome } from "../estoque/matchCategoria";
import { encontrarModeloPorNome } from "../estoque/matchModelo";
import { formatarNomeModeloMoto } from "../motos/nomeModelo";
import type { Categoria, ModeloMoto } from "@/src/types/catalog";
import { InventoryDialog, InventoryDrawer } from "./InventoryDrawer";
import type { GrauUnidade, PecaEstoque } from "./inventoryPreviewModel";

type BulkPieceMode = "nova" | "existente";

export interface BulkPieceDraft {
  modo: BulkPieceMode;
  pecaId?: string;
  nome: string;
  categoriaId: string;
  motoNome: string;
  grau: GrauUnidade;
  /** Grau de cada unidade na fila; `grau` permanece como compatibilidade/primeiro grau. */
  grausPorUnidade?: GrauUnidade[];
  fotos: File[];
  quantidade: number;
  fotosPorUnidade?: File[][];
}

interface BulkInventoryComposerProps {
  aberto: boolean;
  categorias: Categoria[];
  modelos: ModeloMoto[];
  pecas: PecaEstoque[];
  onFechar: () => void;
  onSalvarItem: (item: BulkPieceDraft) => Promise<void>;
  onSalvarItens?: (itens: BulkPieceDraft[]) => Promise<void>;
}

const inputClass = "mt-1 h-11 w-full rounded-control border border-border-default bg-surface-inset px-3 text-base text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30 sm:text-sm";

function nomeModelo(modelo: ModeloMoto, modelos: ModeloMoto[]) {
  return formatarNomeModeloMoto(modelo, modelos) || modelo.nome;
}

function normalizar(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
}

function grausDoItem(item: Pick<BulkPieceDraft, "grau" | "quantidade" | "grausPorUnidade">): GrauUnidade[] {
  return Array.from({ length: item.quantidade }, (_, indice) => item.grausPorUnidade?.[indice] ?? item.grau);
}

function rotuloGraus(item: Pick<BulkPieceDraft, "grau" | "quantidade" | "grausPorUnidade">): string {
  const graus = Array.from(new Set(grausDoItem(item)));
  return graus.length === 1 ? `Grau ${graus[0]}` : `Graus ${graus.join("/")}`;
}

function resolverModeloPorTexto(texto: string, modelos: ModeloMoto[]) {
  const alvo = normalizar(texto);
  if (!alvo) return undefined;
  return modelos.find((modelo) => normalizar(nomeModelo(modelo, modelos)) === alvo || normalizar(modelo.nome) === alvo)
    ?? encontrarModeloPorNome(texto, modelos);
}

export function BulkInventoryComposer({ aberto, categorias, modelos, pecas, onFechar, onSalvarItem, onSalvarItens }: BulkInventoryComposerProps) {
  const [modo, setModo] = useState<BulkPieceMode>("nova");
  const [pecaId, setPecaId] = useState("");
  const [buscaPeca, setBuscaPeca] = useState("");
  const [nome, setNome] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [motoNome, setMotoNome] = useState("");
  const [grau, setGrau] = useState<GrauUnidade>("B");
  const [fotos, setFotos] = useState<File[]>([]);
  const [categoriaEditada, setCategoriaEditada] = useState(false);
  const [motoEditada, setMotoEditada] = useState(false);
  const [fila, setFila] = useState<BulkPieceDraft[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [indiceEditando, setIndiceEditando] = useState<number | null>(null);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  const pecaEscolhida = useMemo(() => pecas.find((peca) => peca.id === pecaId), [pecas, pecaId]);
  const pecasEncontradas = useMemo(() => {
    const alvo = normalizar(buscaPeca);
    return pecas
      .filter((peca) => !alvo || normalizar([peca.nome, peca.codigoLegado, ...peca.compatibilidades].join(" ")).includes(alvo))
      .slice(0, 8);
  }, [buscaPeca, pecas]);
  const categoriaSugerida = useMemo(() => encontrarCategoriaPorNome(nome, categorias), [categorias, nome]);
  const modeloSugerido = useMemo(() => encontrarModeloPorNome(nome, modelos), [modelos, nome]);
  const categoriasResumo = useMemo(() => {
    const contagem = new Map<string, number>();
    fila.forEach((item) => contagem.set(item.categoriaId, (contagem.get(item.categoriaId) ?? 0) + item.quantidade));
    return [...contagem.entries()]
      .map(([id, total]) => ({ nome: categorias.find((categoria) => categoria.id === id)?.nome ?? "Sem categoria", total }))
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [categorias, fila]);
  const motosResumo = useMemo(() => {
    const contagem = new Map<string, number>();
    fila.forEach((item) => contagem.set(item.motoNome, (contagem.get(item.motoNome) ?? 0) + item.quantidade));
    return [...contagem.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
  }, [fila]);
  const totalNaFila = useMemo(() => fila.reduce((total, item) => total + item.quantidade, 0), [fila]);
  const itemAgrupavel = useMemo(() => {
    const alvo = { nome: normalizar(nome), categoriaId, moto: normalizar(motoNome), modo, pecaId };
    if (!alvo.nome || !alvo.moto || (alvo.modo === "nova" && !alvo.categoriaId) || (alvo.modo === "existente" && !alvo.pecaId)) return null;
    return fila.find((item, index) => {
      if (index === indiceEditando || item.modo !== alvo.modo) return false;
      if (alvo.modo === "existente") return item.pecaId === alvo.pecaId;
      return normalizar(item.nome) === alvo.nome && item.categoriaId === alvo.categoriaId && normalizar(item.motoNome) === alvo.moto;
    }) ?? null;
  }, [categoriaId, fila, indiceEditando, modo, motoNome, nome, pecaId]);

  useEffect(() => {
    if (!aberto) {
      setNome("");
      setModo("nova");
      setPecaId("");
      setBuscaPeca("");
      setCategoriaId("");
      setMotoNome("");
      setGrau("B");
      setFotos([]);
      setCategoriaEditada(false);
      setMotoEditada(false);
      setFila([]);
      setSalvando(false);
      setConcluido(false);
      setErro(null);
      setIndiceEditando(null);
      setConfirmandoSaida(false);
    }
  }, [aberto]);

  useEffect(() => {
    if (modo !== "nova") return;
    if (!categoriaEditada) setCategoriaId(categoriaSugerida?.id ?? "");
    if (!motoEditada && modeloSugerido) setMotoNome(nomeModelo(modeloSugerido, modelos));
  }, [categoriaEditada, categoriaSugerida, modeloSugerido, modeloSugerido?.id, modo, motoEditada, modelos]);

  useEffect(() => {
    if (modo !== "existente" || !pecaEscolhida || motoEditada) return;
    setNome(pecaEscolhida.nome);
    setCategoriaId(pecaEscolhida.categoriaId);
    setMotoNome(pecaEscolhida.compatibilidades[0] ?? "");
  }, [modo, motoEditada, pecaEscolhida]);

  function limparFormulario() {
    setModo("nova");
    setPecaId("");
    setBuscaPeca("");
    setNome("");
    setCategoriaId("");
    setMotoNome("");
    setGrau("B");
    setFotos([]);
    setCategoriaEditada(false);
    setMotoEditada(false);
    setErro(null);
  }

  function validarAtual() {
    if (modo === "existente" && !pecaEscolhida) return "Escolha uma peça existente do estoque.";
    if (!nome.trim()) return "Informe o nome da peça.";
    if (modo === "nova" && !categoriaId) return "Escolha uma categoria ou digite um nome que permita sugeri-la.";
    if (!motoNome.trim()) return "Informe a moto. Ela pode ser nova e será adicionada ao catálogo.";
    return null;
  }

  function proxima() {
    const mensagem = validarAtual();
    if (mensagem) {
      setErro(mensagem);
      return;
    }
    const item: BulkPieceDraft = { modo, pecaId: modo === "existente" ? pecaId : undefined, nome: nome.trim(), categoriaId, motoNome: motoNome.trim(), grau, grausPorUnidade: [grau], fotos, quantidade: 1, fotosPorUnidade: [fotos] };
    setFila((atual) => {
      if (indiceEditando !== null) {
        return atual.map((anterior, index) => index === indiceEditando ? {
          ...item,
          quantidade: anterior.quantidade,
          grausPorUnidade: [grau, ...grausDoItem(anterior).slice(1)],
          fotosPorUnidade: [fotos, ...(anterior.fotosPorUnidade ?? []).slice(1)],
        } : anterior);
      }
      const indiceAgrupavel = atual.findIndex((anterior) => anterior.modo === item.modo && (item.modo === "existente" ? anterior.pecaId === item.pecaId : normalizar(anterior.nome) === normalizar(item.nome) && anterior.categoriaId === item.categoriaId && normalizar(anterior.motoNome) === normalizar(item.motoNome)));
      if (indiceAgrupavel < 0) return [...atual, item];
      return atual.map((anterior, index) => index === indiceAgrupavel ? {
        ...anterior,
        quantidade: anterior.quantidade + item.quantidade,
        grausPorUnidade: [...grausDoItem(anterior), ...grausDoItem(item)],
        fotos: [...anterior.fotos, ...item.fotos],
        fotosPorUnidade: [...(anterior.fotosPorUnidade ?? [anterior.fotos]), ...(item.fotosPorUnidade ?? [item.fotos])],
      } : anterior);
    });
    setIndiceEditando(null);
    limparFormulario();
  }

  function editarItem(index: number) {
    const item = fila[index];
    if (!item || salvando) return;
    setIndiceEditando(index);
    setModo(item.modo);
    setPecaId(item.pecaId ?? "");
    setBuscaPeca(item.nome);
    setNome(item.nome);
    setCategoriaId(item.categoriaId);
    setMotoNome(item.motoNome);
    setGrau(grausDoItem(item)[0] ?? item.grau);
    setFotos(item.fotosPorUnidade?.[0] ?? item.fotos);
    setCategoriaEditada(true);
    setMotoEditada(true);
    setErro(null);
  }

  function solicitarFechamento() {
    if (salvando) return;
    const formularioPreenchido = Boolean(pecaId || nome.trim() || categoriaId || motoNome.trim() || fotos.length);
    if (concluido || (!fila.length && !formularioPreenchido)) {
      onFechar();
      return;
    }
    setConfirmandoSaida(true);
  }

  async function concluirAdicoes() {
    const mensagem = modo !== "nova" || nome.trim() || categoriaId || motoNome.trim() || fotos.length ? validarAtual() : null;
    if (mensagem) {
      setErro(mensagem);
      return;
    }
    if (!fila.length) {
      setErro("Adicione pelo menos uma peça antes de concluir.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      if (onSalvarItens) {
        await onSalvarItens(fila);
      } else {
        for (const item of fila) {
          for (let indice = 0; indice < item.quantidade; indice += 1) {
            await onSalvarItem({ ...item, quantidade: 1, grau: item.grausPorUnidade?.[indice] ?? item.grau, grausPorUnidade: undefined, fotos: item.fotosPorUnidade?.[indice] ?? item.fotos });
          }
        }
      }
      setConcluido(true);
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : "Não foi possível concluir as adições.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <InventoryDrawer
      isOpen={aberto}
      onClose={solicitarFechamento}
      title={concluido ? "Adições concluídas" : "Adicionar peças em massa"}
      footer={concluido ? (
        <button type="button" onClick={onFechar} className="inline-flex h-11 items-center gap-2 rounded-control bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
          Fechar
        </button>
      ) : (
        <div className="flex w-full items-center justify-between gap-3">
          <button type="button" disabled={salvando} onClick={solicitarFechamento} className="h-11 rounded-control px-3 text-sm font-medium text-text-muted transition hover:bg-surface-raised hover:text-text-primary disabled:opacity-50">Cancelar</button>
          <div className="flex items-center gap-2">
            <button type="button" disabled={salvando} onClick={proxima} className="inline-flex h-11 items-center gap-2 rounded-control border border-border-default bg-surface-card px-4 text-sm font-semibold text-text-secondary transition hover:border-accent/40 hover:text-accent disabled:opacity-50"><Plus size={16} />{indiceEditando === null ? "Próxima" : "Atualizar item"}</button>
            <button type="button" disabled={salvando || totalNaFila === 0} onClick={() => void concluirAdicoes()} className="inline-flex h-11 items-center gap-2 rounded-control bg-accent px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">{salvando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}Concluir adições ({totalNaFila})</button>
          </div>
        </div>
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {concluido ? (
          <motion.section key="sucesso" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 py-3">
            <div className="rounded-card border border-positive/25 bg-positive-bg p-5 text-center">
              <motion.div initial={{ scale: 0.7, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 420, damping: 18 }} className="mx-auto grid size-14 place-items-center rounded-full bg-positive text-white shadow-sm"><Check size={30} strokeWidth={3} /></motion.div>
              <h3 className="mt-3 text-xl font-semibold text-text-primary">Tudo salvo no estoque</h3>
          <p className="mt-1 text-sm text-text-secondary">{totalNaFila} {totalNaFila === 1 ? "peça foi adicionada" : "peças foram adicionadas"}. Elas continuam sinalizadas para completar preço, ficha e organização.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-control border border-border-default bg-surface-card p-4"><p className="text-xs font-semibold text-text-muted">Peças adicionadas</p><p className="mt-1 text-3xl font-semibold tracking-tight text-text-primary">{totalNaFila}</p><p className="mt-1 text-xs text-warning">Pendências de complemento visíveis no estoque</p></div>
              <div className="rounded-control border border-border-default bg-surface-card p-4"><p className="text-xs font-semibold text-text-muted">Motos relacionadas</p><p className="mt-1 text-3xl font-semibold tracking-tight text-text-primary">{motosResumo.length}</p><p className="mt-1 text-xs text-text-secondary">Modelos existentes ou criados agora</p></div>
            </div>
            <div className="rounded-control border border-border-default bg-surface-inset p-4"><p className="flex items-center gap-2 text-sm font-semibold text-text-primary"><Sparkles size={15} className="text-accent" />Categorias mais adicionadas</p><div className="mt-3 space-y-2">{categoriasResumo.map((categoria) => <div key={categoria.nome} className="flex items-center justify-between gap-3 text-sm"><span className="truncate text-text-secondary">{categoria.nome}</span><span className="font-mono text-xs text-text-muted">{categoria.total} {categoria.total === 1 ? "peça" : "peças"}</span></div>)}</div></div>
            <p className="text-xs leading-5 text-text-muted">A próxima etapa é completar cada ficha com preço, condição e localização quando essas informações estiverem disponíveis.</p>
          </motion.section>
        ) : (
          <motion.div key="formulario" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="rounded-control border border-accent/20 bg-accent-soft-bg/50 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-accent-soft-fg"><ListPlus size={16} />Cadastro rápido, complemento depois</p><p className="mt-1 text-xs leading-5 text-text-secondary">Cadastre uma peça nova ou adicione outra unidade a uma peça que já existe, sem duplicar o cadastro.</p></div>
            {fila.length > 0 && <section aria-label="Peças na fila" className="space-y-2"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Na fila</p><span className="font-mono text-xs text-text-muted">{totalNaFila} {totalNaFila === 1 ? "item" : "itens"}</span></div><div className="space-y-2">{fila.map((item, index) => <motion.div layout key={`${item.nome}-${index}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 rounded-control border border-border-default bg-surface-card p-3"><div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-control bg-surface-inset text-text-faint">{item.fotos.length ? <ImagePlus size={16} /> : <ImagePlus size={16} className="opacity-40" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-text-primary">{item.nome}</p><p className="truncate text-xs text-text-muted">{item.motoNome} · {rotuloGraus(item)} · {item.quantidade} {item.quantidade === 1 ? "unidade" : "unidades"} · {item.fotos.length} {item.fotos.length === 1 ? "foto" : "fotos"}</p></div><div className="flex shrink-0 items-center gap-1"><button type="button" aria-label={`Editar ${item.nome}`} disabled={salvando} onClick={() => editarItem(index)} className="grid size-9 place-items-center rounded-control text-text-faint transition hover:bg-accent-soft-bg hover:text-accent-soft-fg disabled:opacity-50"><Pencil size={15} /></button><button type="button" aria-label={`Remover ${item.nome}`} disabled={salvando} onClick={() => setFila((atual) => atual.filter((_, itemIndex) => itemIndex !== index))} className="grid size-9 place-items-center rounded-control text-text-faint transition hover:bg-danger-bg hover:text-danger disabled:opacity-50"><Trash2 size={15} /></button></div></motion.div>)}</div></section>}
            <section className="space-y-4" aria-labelledby="bulk-identificar">
              <div><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">{indiceEditando === null ? "Próxima peça" : "Editando item da fila"}</p><h3 id="bulk-identificar" className="mt-1 text-lg font-semibold text-text-primary">O que entrou no galpão?</h3></div>
              <div role="group" aria-label="Tipo de adição" className="grid grid-cols-2 gap-1 rounded-control border border-border-default bg-surface-inset p-1">
                <button type="button" aria-pressed={modo === "nova"} onClick={() => { setModo("nova"); setPecaId(""); setBuscaPeca(""); setNome(""); setCategoriaId(""); setMotoNome(""); setMotoEditada(false); setCategoriaEditada(false); setErro(null); }} className={`min-h-10 rounded-[6px] px-3 text-sm font-semibold transition ${modo === "nova" ? "bg-surface-card text-accent-soft-fg shadow-sm" : "text-text-muted hover:text-text-primary"}`}>Peça nova</button>
                <button type="button" aria-pressed={modo === "existente"} onClick={() => { setModo("existente"); setPecaId(""); setBuscaPeca(""); setNome(""); setCategoriaId(""); setMotoNome(""); setMotoEditada(false); setErro(null); }} className={`min-h-10 rounded-[6px] px-3 text-sm font-semibold transition ${modo === "existente" ? "bg-surface-card text-accent-soft-fg shadow-sm" : "text-text-muted hover:text-text-primary"}`}>Adicionar existente</button>
              </div>
              {modo === "existente" ? <>
                <label className="block text-sm font-semibold text-text-secondary">Buscar peça existente<input aria-label="Buscar peça existente" autoFocus className={inputClass} value={buscaPeca} onChange={(event) => setBuscaPeca(event.target.value)} placeholder="Nome, código ou moto" /></label>
                <div role="listbox" aria-label="Peças existentes" className="max-h-44 space-y-1 overflow-y-auto rounded-control border border-border-default bg-surface-inset p-1">
                  {pecasEncontradas.length ? pecasEncontradas.map((peca) => <button key={peca.id} type="button" role="option" aria-selected={peca.id === pecaId} onClick={() => { setPecaId(peca.id); setNome(peca.nome); setCategoriaId(peca.categoriaId); setMotoNome(peca.compatibilidades[0] ?? ""); setMotoEditada(false); setErro(null); }} className={`flex w-full items-start justify-between gap-3 rounded-control px-3 py-2.5 text-left transition ${peca.id === pecaId ? "bg-accent-soft-bg text-accent-soft-fg" : "text-text-secondary hover:bg-surface-card"}`}><span className="min-w-0"><span className="block truncate text-sm font-semibold">{peca.nome}</span><span className="mt-0.5 block truncate text-xs text-text-muted">{peca.codigoLegado}{peca.compatibilidades[0] ? ` · ${peca.compatibilidades[0]}` : ""}</span></span>{peca.id === pecaId && <Check size={16} className="mt-0.5 shrink-0" />}</button>) : <p className="px-3 py-4 text-center text-xs text-text-muted">Nenhuma peça encontrada. Troque para “Peça nova” para cadastrar.</p>}
                </div>
                {pecaEscolhida && <div className="rounded-control border border-positive/25 bg-positive-bg px-3 py-2.5 text-sm text-positive"><span className="font-semibold">Unidade adicional:</span> {pecaEscolhida.nome} · {categorias.find((categoria) => categoria.id === pecaEscolhida.categoriaId)?.nome ?? "Sem categoria"}</div>}
              </> : <label className="block text-sm font-semibold text-text-secondary">Nome da peça<input aria-label="Nome da peça" autoFocus className={inputClass} value={nome} onChange={(event) => setNome(event.target.value)} placeholder="Ex.: Farol CG 160" /></label>}
              <div className="grid gap-3 sm:grid-cols-2">
                {modo === "nova" ? <Combobox label="Categoria" placeholder="Sugerida pelo nome" options={categorias.map((categoria) => ({ value: categoria.id, label: categoria.nome }))} value={categoriaId} onChange={(valor) => { setCategoriaEditada(true); setCategoriaId(valor); }} size="lg" /> : <div className="rounded-control border border-border-default bg-surface-inset px-3 py-2.5"><p className="text-xs font-semibold text-text-muted">Categoria</p><p className="mt-1 truncate text-sm text-text-primary">{categorias.find((categoria) => categoria.id === categoriaId)?.nome ?? "Da peça existente"}</p></div>}
                <label className="block text-sm font-semibold text-text-secondary">Moto compatível<input aria-label="Moto compatível" list="bulk-motos-catalogo" className={inputClass} value={motoNome} onChange={(event) => { setMotoEditada(true); setMotoNome(event.target.value); }} placeholder="Pode ser uma moto nova" /><datalist id="bulk-motos-catalogo">{modelos.map((modelo) => <option key={modelo.id} value={nomeModelo(modelo, modelos)} />)}</datalist></label>
              </div>
              <fieldset><legend className="text-sm font-semibold text-text-secondary">Grau da unidade</legend><p className="mt-1 text-xs font-normal text-text-muted">Você pode ajustar depois na ficha da peça.</p><div className="mt-2 grid grid-cols-3 gap-2">{(["A", "B", "C"] as GrauUnidade[]).map((opcao) => <button key={opcao} type="button" aria-pressed={grau === opcao} onClick={() => setGrau(opcao)} className={`min-h-11 rounded-control border text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 ${grau === opcao ? "border-accent/40 bg-accent-soft-bg text-accent-soft-fg" : "border-border-default bg-surface-inset text-text-muted hover:border-accent/30 hover:text-text-primary"}`}>Grau {opcao}</button>)}</div></fieldset>
              {itemAgrupavel && <p className="rounded-control border border-positive/30 bg-positive-bg px-3 py-2 text-xs text-positive">Esta peça já está na fila e será agregada automaticamente como mais uma unidade.</p>}
              {modo === "nova" && (categoriaSugerida || modeloSugerido) && <p className="flex items-center gap-1.5 text-xs text-accent-soft-fg"><Sparkles size={13} />{categoriaSugerida ? `Categoria sugerida: ${categoriaSugerida.nome}.` : ""}{modeloSugerido ? ` Moto encontrada no catálogo: ${nomeModelo(modeloSugerido, modelos)}.` : ""}</p>}
              <div><p className="mb-2 text-sm font-semibold text-text-secondary">Fotos da peça <span className="font-normal text-text-faint">(até 10 agora)</span></p><EstoqueUploadFotos imagens={[]} onRemoverImagem={() => undefined} onArquivosSelecionados={(arquivos) => { if (fotos.length + arquivos.length > 10) { setErro("Cada unidade pode ter até 10 fotos."); return; } setErro(null); setFotos((atuais) => [...atuais, ...arquivos]); }} enviando={salvando} resumoCompressao={null} />{fotos.length > 0 && <ul className="mt-2 space-y-1" aria-label="Fotos selecionadas">{fotos.map((foto, indice) => <li key={`${foto.name}-${indice}`} className="flex items-center justify-between gap-3 rounded-control border border-positive/25 bg-positive-bg px-3 py-2 text-xs text-positive"><span className="flex min-w-0 items-center gap-2"><CheckCircle2 size={14} /><span className="truncate">{foto.name}</span></span><button type="button" aria-label={`Remover ${foto.name}`} disabled={salvando} onClick={() => setFotos((atuais) => atuais.filter((_, fotoIndex) => fotoIndex !== indice))} className="rounded p-1 hover:bg-white/50"><X size={14} /></button></li>)}</ul>}</div>
              {erro && <p role="alert" className="rounded-control border border-danger/30 bg-danger-bg p-3 text-sm text-danger">{erro}</p>}
            </section>
          </motion.div>
        )}
      </AnimatePresence>
      </InventoryDrawer>
      <InventoryDialog isOpen={confirmandoSaida} onClose={() => setConfirmandoSaida(false)} title="Sair do cadastro em massa?" description="A fila e o preenchimento atual ainda não foram salvos. Você pode continuar adicionando ou sair e descartar tudo." footer={<><button type="button" onClick={() => setConfirmandoSaida(false)} className="inline-flex min-h-11 items-center rounded-control border border-border-default bg-surface-card px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-raised">Continuar adicionando</button><button type="button" onClick={() => { setConfirmandoSaida(false); onFechar(); }} className="inline-flex min-h-11 items-center rounded-control bg-danger px-4 text-sm font-semibold text-white transition hover:opacity-90">Sair e descartar</button></>} />
    </>
  );
}
