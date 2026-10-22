import { AnimatePresence, motion } from "motion/react";
import { Check, CheckCircle2, ImagePlus, ListPlus, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Combobox } from "@/src/components/ui/Combobox";
import { EstoqueUploadFotos } from "../estoque/EstoqueUploadFotos";
import { encontrarCategoriaPorNome } from "../estoque/matchCategoria";
import { encontrarModeloPorNome } from "../estoque/matchModelo";
import { formatarNomeModeloMoto } from "../motos/nomeModelo";
import type { Categoria, ModeloMoto } from "@/src/types/catalog";
import { InventoryDrawer } from "./InventoryDrawer";
import type { PecaEstoque } from "./inventoryPreviewModel";

type BulkPieceMode = "nova" | "existente";

export interface BulkPieceDraft {
  modo: BulkPieceMode;
  pecaId?: string;
  nome: string;
  categoriaId: string;
  motoNome: string;
  foto?: File;
}

interface BulkInventoryComposerProps {
  aberto: boolean;
  categorias: Categoria[];
  modelos: ModeloMoto[];
  pecas: PecaEstoque[];
  onFechar: () => void;
  onSalvarItem: (item: BulkPieceDraft) => Promise<void>;
}

const inputClass = "mt-1 h-11 w-full rounded-control border border-border-default bg-surface-inset px-3 text-base text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30 sm:text-sm";

function nomeModelo(modelo: ModeloMoto, modelos: ModeloMoto[]) {
  return formatarNomeModeloMoto(modelo, modelos) || modelo.nome;
}

function normalizar(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

function resolverModeloPorTexto(texto: string, modelos: ModeloMoto[]) {
  const alvo = normalizar(texto);
  if (!alvo) return undefined;
  return modelos.find((modelo) => normalizar(nomeModelo(modelo, modelos)) === alvo || normalizar(modelo.nome) === alvo)
    ?? encontrarModeloPorNome(texto, modelos);
}

export function BulkInventoryComposer({ aberto, categorias, modelos, pecas, onFechar, onSalvarItem }: BulkInventoryComposerProps) {
  const [modo, setModo] = useState<BulkPieceMode>("nova");
  const [pecaId, setPecaId] = useState("");
  const [buscaPeca, setBuscaPeca] = useState("");
  const [nome, setNome] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [motoNome, setMotoNome] = useState("");
  const [foto, setFoto] = useState<File | undefined>();
  const [categoriaEditada, setCategoriaEditada] = useState(false);
  const [motoEditada, setMotoEditada] = useState(false);
  const [fila, setFila] = useState<BulkPieceDraft[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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
    fila.forEach((item) => contagem.set(item.categoriaId, (contagem.get(item.categoriaId) ?? 0) + 1));
    return [...contagem.entries()]
      .map(([id, total]) => ({ nome: categorias.find((categoria) => categoria.id === id)?.nome ?? "Sem categoria", total }))
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [categorias, fila]);
  const motosResumo = useMemo(() => {
    const contagem = new Map<string, number>();
    fila.forEach((item) => contagem.set(item.motoNome, (contagem.get(item.motoNome) ?? 0) + 1));
    return [...contagem.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
  }, [fila]);

  useEffect(() => {
    if (!aberto) {
      setNome("");
      setModo("nova");
      setPecaId("");
      setBuscaPeca("");
      setCategoriaId("");
      setMotoNome("");
      setFoto(undefined);
      setCategoriaEditada(false);
      setMotoEditada(false);
      setFila([]);
      setSalvando(false);
      setConcluido(false);
      setErro(null);
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
    setFoto(undefined);
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
    setFila((atual) => [...atual, { modo, pecaId: modo === "existente" ? pecaId : undefined, nome: nome.trim(), categoriaId, motoNome: motoNome.trim(), foto }]);
    limparFormulario();
  }

  async function concluirAdicoes() {
    const mensagem = modo !== "nova" || nome.trim() || categoriaId || motoNome.trim() || foto ? validarAtual() : null;
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
      for (const item of fila) await onSalvarItem(item);
      setConcluido(true);
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : "Não foi possível concluir as adições.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <InventoryDrawer
      isOpen={aberto}
      onClose={onFechar}
      title={concluido ? "Adições concluídas" : "Adicionar peças em massa"}
      footer={concluido ? (
        <button type="button" onClick={onFechar} className="inline-flex h-11 items-center gap-2 rounded-control bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
          Fechar
        </button>
      ) : (
        <div className="flex w-full items-center justify-between gap-3">
          <button type="button" disabled={salvando} onClick={onFechar} className="h-11 rounded-control px-3 text-sm font-medium text-text-muted transition hover:bg-surface-raised hover:text-text-primary disabled:opacity-50">Cancelar</button>
          <div className="flex items-center gap-2">
            <button type="button" disabled={salvando} onClick={proxima} className="inline-flex h-11 items-center gap-2 rounded-control border border-border-default bg-surface-card px-4 text-sm font-semibold text-text-secondary transition hover:border-accent/40 hover:text-accent disabled:opacity-50"><Plus size={16} />Próxima</button>
            <button type="button" disabled={salvando || fila.length === 0} onClick={() => void concluirAdicoes()} className="inline-flex h-11 items-center gap-2 rounded-control bg-accent px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">{salvando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}Concluir adições ({fila.length})</button>
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
              <p className="mt-1 text-sm text-text-secondary">{fila.length} {fila.length === 1 ? "peça foi adicionada" : "peças foram adicionadas"}. Elas continuam sinalizadas para completar preço, ficha e organização.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-control border border-border-default bg-surface-card p-4"><p className="text-xs font-semibold text-text-muted">Peças adicionadas</p><p className="mt-1 text-3xl font-semibold tracking-tight text-text-primary">{fila.length}</p><p className="mt-1 text-xs text-warning">Pendências de complemento visíveis no estoque</p></div>
              <div className="rounded-control border border-border-default bg-surface-card p-4"><p className="text-xs font-semibold text-text-muted">Motos relacionadas</p><p className="mt-1 text-3xl font-semibold tracking-tight text-text-primary">{motosResumo.length}</p><p className="mt-1 text-xs text-text-secondary">Modelos existentes ou criados agora</p></div>
            </div>
            <div className="rounded-control border border-border-default bg-surface-inset p-4"><p className="flex items-center gap-2 text-sm font-semibold text-text-primary"><Sparkles size={15} className="text-accent" />Categorias mais adicionadas</p><div className="mt-3 space-y-2">{categoriasResumo.map((categoria) => <div key={categoria.nome} className="flex items-center justify-between gap-3 text-sm"><span className="truncate text-text-secondary">{categoria.nome}</span><span className="font-mono text-xs text-text-muted">{categoria.total} {categoria.total === 1 ? "peça" : "peças"}</span></div>)}</div></div>
            <p className="text-xs leading-5 text-text-muted">A próxima etapa é completar cada ficha com preço, condição e localização quando essas informações estiverem disponíveis.</p>
          </motion.section>
        ) : (
          <motion.div key="formulario" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="rounded-control border border-accent/20 bg-accent-soft-bg/50 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-accent-soft-fg"><ListPlus size={16} />Cadastro rápido, complemento depois</p><p className="mt-1 text-xs leading-5 text-text-secondary">Cadastre uma peça nova ou adicione outra unidade a uma peça que já existe, sem duplicar o cadastro.</p></div>
            {fila.length > 0 && <section aria-label="Peças na fila" className="space-y-2"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Na fila</p><span className="font-mono text-xs text-text-muted">{fila.length} {fila.length === 1 ? "item" : "itens"}</span></div><div className="space-y-2">{fila.map((item, index) => <motion.div layout key={`${item.nome}-${index}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 rounded-control border border-border-default bg-surface-card p-3"><div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-control bg-surface-inset text-text-faint">{item.foto ? <ImagePlus size={16} /> : <ImagePlus size={16} className="opacity-40" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-text-primary">{item.nome}</p><p className="truncate text-xs text-text-muted">{item.motoNome} · {categorias.find((categoria) => categoria.id === item.categoriaId)?.nome}</p></div><button type="button" aria-label={`Remover ${item.nome}`} disabled={salvando} onClick={() => setFila((atual) => atual.filter((_, itemIndex) => itemIndex !== index))} className="grid size-9 shrink-0 place-items-center rounded-control text-text-faint transition hover:bg-danger-bg hover:text-danger disabled:opacity-50"><Trash2 size={15} /></button></motion.div>)}</div></section>}
            <section className="space-y-4" aria-labelledby="bulk-identificar">
              <div><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">Próxima peça</p><h3 id="bulk-identificar" className="mt-1 text-lg font-semibold text-text-primary">O que entrou no galpão?</h3></div>
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
              {modo === "nova" && (categoriaSugerida || modeloSugerido) && <p className="flex items-center gap-1.5 text-xs text-accent-soft-fg"><Sparkles size={13} />{categoriaSugerida ? `Categoria sugerida: ${categoriaSugerida.nome}.` : ""}{modeloSugerido ? ` Moto encontrada no catálogo: ${nomeModelo(modeloSugerido, modelos)}.` : ""}</p>}
              <div><p className="mb-2 text-sm font-semibold text-text-secondary">Foto da peça <span className="font-normal text-text-faint">(opcional agora)</span></p><EstoqueUploadFotos imagens={[]} onRemoverImagem={() => setFoto(undefined)} onArquivosSelecionados={(arquivos) => setFoto(arquivos[0])} enviando={salvando} resumoCompressao={null} />{foto && <div className="mt-2 flex items-center justify-between gap-3 rounded-control border border-positive/25 bg-positive-bg px-3 py-2 text-xs text-positive"><span className="flex min-w-0 items-center gap-2"><CheckCircle2 size={14} /><span className="truncate">{foto.name}</span></span><button type="button" aria-label="Remover foto selecionada" onClick={() => setFoto(undefined)} className="rounded p-1 hover:bg-white/50"><X size={14} /></button></div>}</div>
              {erro && <p role="alert" className="rounded-control border border-danger/30 bg-danger-bg p-3 text-sm text-danger">{erro}</p>}
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </InventoryDrawer>
  );
}
