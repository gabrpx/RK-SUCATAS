import { CheckCircle2, Layers3, Loader2, PackagePlus, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Combobox } from "@/src/components/ui/Combobox";
import { InventoryDrawer } from "./InventoryDrawer";
import { EstoqueUploadFotos } from "../estoque/EstoqueUploadFotos";
import { enderecosPrateleira, type CategoriaEstoque, type GrauUnidade, type NovaUnidadeInput, type PecaEstoque } from "./inventoryPreviewModel";

interface InventoryComposerProps {
  aberto: boolean;
  categorias: CategoriaEstoque[];
  pecas: PecaEstoque[];
  onFechar: () => void;
  onSalvar: (entrada: NovaUnidadeInput, cacheFotos: Map<File, string>) => Promise<void | { completo: boolean; mensagem: string; fotosAnexadas?: boolean }> | void;
  /** Descarta fotos enviadas que não chegaram a ser gravadas (cadastro abandonado). */
  onDescartarFotos?: (urls: string[]) => void;
  enderecos?: { value: string; label: string }[];
  operacional?: boolean;
  /** Abre direto em "Usar existente" com esta peça (ex.: peça sem estoque na lista). */
  pecaInicialId?: string | null;
}

const inputClass = "mt-1 h-11 w-full rounded-control font-normal border border-border-default bg-surface-inset px-3 text-base text-text-primary sm:text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30";

function normalizar(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

function saoSemelhantes(nome: string, peca: PecaEstoque) {
  const consulta = normalizar(nome);
  if (consulta.length < 3) return false;
  const alvo = normalizar(peca.nome);
  if (alvo.includes(consulta) || consulta.includes(alvo)) return true;
  const palavras = consulta.split(/[^a-z0-9]+/).filter((palavra) => palavra.length >= 3);
  return palavras.length > 0 && palavras.filter((palavra) => alvo.includes(palavra)).length >= Math.min(2, palavras.length);
}

export function InventoryComposer({ aberto, categorias, pecas, onFechar, onSalvar, onDescartarFotos, enderecos = enderecosPrateleira, operacional = false, pecaInicialId = null }: InventoryComposerProps) {
  const [etapa, setEtapa] = useState(0);
  const [modo, setModo] = useState<"nova" | "existente">("nova");
  const [pecaId, setPecaId] = useState("");
  const [nome, setNome] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [condicaoOrigem, setCondicaoOrigem] = useState<"original" | "paralela">("original");
  const [notaCadastro, setNotaCadastro] = useState<"com_nota" | "sem_nota" | "">("");
  const [compatibilidade, setCompatibilidade] = useState("");
  const [preco, setPreco] = useState("");
  const [grau, setGrau] = useState<GrauUnidade>("B");
  const [origem, setOrigem] = useState("");
  const [endereco, setEndereco] = useState("");
  const [erroEtapa, setErroEtapa] = useState<string | null>(null);
  const [fotos, setFotos] = useState<File[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [cadastroParcial, setCadastroParcial] = useState(false);

  const pecaEscolhida = pecas.find((peca) => peca.id === pecaId);
  const semelhantes = useMemo(() => modo === "nova" ? pecas.filter((peca) => saoSemelhantes(nome, peca)).slice(0, 3) : [], [modo, nome, pecas]);
  const enderecoNormalizado = endereco.trim() || null;
  const precoRef = useRef<HTMLInputElement>(null);
  const enderecoRef = useRef<HTMLButtonElement>(null);
  // Fotos já enviadas nesta sessão do cadastro (arquivo → URL): repetir o
  // salvamento reaproveita as URLs, e fechar sem concluir descarta as órfãs.
  const fotosEnviadas = useRef(new Map<File, string>());

  useEffect(() => {
    if (!aberto) return;
    if (etapa === 1) precoRef.current?.focus();
    if (etapa === 2) enderecoRef.current?.focus();
  }, [aberto, etapa]);
  useEffect(() => {
    if (!aberto || !pecaInicialId) return;
    setModo("existente");
    setPecaId(pecaInicialId);
  }, [aberto, pecaInicialId]);
  useEffect(() => {
    if (aberto) return;
    if (fotosEnviadas.current.size) {
      onDescartarFotos?.([...fotosEnviadas.current.values()]);
      fotosEnviadas.current = new Map();
    }
    setEtapa(0);
    setModo("nova");
    setPecaId("");
    setNome("");
    setCategoriaId("");
    setCondicaoOrigem("original");
    setNotaCadastro("");
    setCompatibilidade("");
    setPreco("");
    setGrau("B");
    setOrigem("");
    setEndereco("");
    setErroEtapa(null);
    setFotos([]);
    setErroSalvar(null);
    setCadastroParcial(false);
  }, [aberto]);

  function usarExistente(peca: PecaEstoque) {
    setModo("existente");
    setPecaId(peca.id);
    setErroEtapa(null);
  }

  function validarEtapaAtual() {
    if (etapa !== 0) return true;
    if (modo === "existente" && pecaEscolhida) return true;
    if (modo === "nova" && nome.trim() && categoriaId) return true;
    setErroEtapa(modo === "nova" ? "Informe o nome e a categoria antes de continuar." : "Escolha a peça existente antes de continuar.");
    return false;
  }

  async function salvar() {
    if (salvando || cadastroParcial) return;
    if (operacional && (!preco.trim() || Number(preco) <= 0 || !Number.isFinite(Number(preco)))) {
      setErroSalvar("Informe um preço de venda maior que zero antes de cadastrar.");
      return;
    }
    setSalvando(true);
    setErroSalvar(null);
    try {
      const resultado = await onSalvar({
      pecaId: modo === "existente" ? pecaId : undefined,
      novaPeca: modo === "nova" ? { nome: nome.trim(), categoriaId, condicao: condicaoOrigem, notaCadastro: notaCadastro || null, compatibilidades: compatibilidade ? [compatibilidade.trim()] : [] } : undefined,
      preco: preco ? Number(preco) : null,
      grau,
      origem: origem.trim() || null,
      fotoUrl: null,
      endereco: enderecoNormalizado,
      fotos,
      }, fotosEnviadas.current);
      // URLs gravadas na ficha não são órfãs: não entram no descarte.
      if (!resultado || resultado.fotosAnexadas !== false) fotosEnviadas.current = new Map();
      if (resultado && !resultado.completo) {
        setCadastroParcial(true);
        setErroSalvar(`${resultado.mensagem} Não repita o cadastro: feche e confira a ficha no estoque.`);
        return;
      }
      onFechar();
      setEtapa(0);
      setErroEtapa(null);
      setFotos([]);
    } catch (erro) {
      setErroSalvar(erro instanceof Error ? erro.message : "Não foi possível salvar a unidade. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  function proxima() {
    if (!validarEtapaAtual()) return;
    setErroEtapa(null);
    setEtapa((atual) => Math.min(3, atual + 1));
  }

  return (
    <InventoryDrawer isOpen={aberto} onClose={onFechar} title="Nova peça e primeira unidade">
      <div className="space-y-5">
        <div className="rounded-control border border-accent/15 bg-accent-soft-bg/50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-soft-fg">Cadastro guiado · etapa {etapa + 1} de 4</p>
          <p className="mt-1 text-sm leading-5 text-text-secondary"><strong className="text-text-primary">Primeira unidade</strong>: você registra uma peça física agora. Cada uma terá sua própria foto, preço, condição e localização.</p>
        </div>

        {etapa === 0 && <section className="space-y-4" aria-labelledby="identificar-peca">
          <div><p className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">1 · Identificar</p><h3 id="identificar-peca" className="mt-1 text-lg font-semibold text-text-primary">Qual peça física você está cadastrando?</h3><p className="mt-1 text-sm text-text-muted">Antes de criar outro nome, o sistema procura peças parecidas para não duplicar o catálogo.</p></div>
          <div className="grid gap-2 sm:grid-cols-2">
            {(["nova", "existente"] as const).map((opcao) => <button key={opcao} type="button" aria-pressed={modo === opcao} onClick={() => { setModo(opcao); setErroEtapa(null); }} className={`cursor-pointer rounded-control border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 ${modo === opcao ? "border-accent/40 bg-accent-soft-bg text-accent-soft-fg" : "border-border-default bg-surface-inset text-text-secondary hover:border-accent/30 hover:bg-surface-raised"}`}>
              <span className="flex items-center gap-2 font-semibold">{opcao === "nova" ? <PackagePlus size={16} /> : <Layers3 size={16} />}{opcao === "nova" ? "Criar peça" : "Usar existente"}</span>
              <span className="mt-1 block text-xs leading-5 text-text-muted">{opcao === "nova" ? "Ainda não existe este tipo no catálogo" : "Adicionar outra unidade a um nome já cadastrado"}</span>
            </button>)}
          </div>
          {modo === "nova" ? <div className="space-y-3">
            <label className="block text-sm font-semibold text-text-secondary">Nome da Peça<input aria-label="Nome da Peça" className={inputClass} value={nome} onChange={(e) => { setNome(e.target.value); setErroEtapa(null); }} placeholder="Ex.: suporte de placa CG 160" autoFocus /></label>
            {semelhantes.length > 0 && <section aria-live="polite" className="rounded-control border border-accent/25 bg-accent-soft-bg p-3"><p className="flex items-center gap-2 text-sm font-semibold text-accent-soft-fg"><Sparkles size={16} />Já existe uma peça parecida</p><p className="mt-1 text-xs leading-5 text-accent-soft-fg">Para evitar dois cadastros do mesmo tipo, adicione esta unidade ao registro abaixo.</p><div className="mt-3 space-y-2">{semelhantes.map((peca) => <button type="button" key={peca.id} aria-label={`Usar existente: ${peca.codigoLegado}`} onClick={() => usarExistente(peca)} className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-control border border-accent/25 bg-surface-card px-3 py-2 text-left text-sm transition hover:border-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 active:scale-[.99]"><span className="min-w-0"><strong className="block truncate text-text-primary">{peca.nome}</strong><span className="text-xs text-text-muted">{peca.codigoLegado} · {peca.compatibilidades.join(" · ") || "Moto não informada"}</span></span><span className="shrink-0 text-xs font-semibold text-accent-soft-fg">Usar existente</span></button>)}</div></section>}
            <Combobox label="Categoria" placeholder="Escolha uma categoria" options={categorias.map((categoria) => ({ value: categoria.id, label: categoria.nome }))} value={categoriaId} onChange={setCategoriaId} size="lg" />
            <div className="grid gap-3 sm:grid-cols-2"><Combobox label="Procedência da peça" options={[{ value: "original", label: "Original" }, { value: "paralela", label: "Paralela" }]} value={condicaoOrigem} onChange={(valor) => setCondicaoOrigem(valor as "original" | "paralela")} size="lg" /><Combobox label="Nota para cadastro (quando exigida)" placeholder="Não se aplica" options={[{ value: "", label: "Não se aplica" }, { value: "com_nota", label: "Com nota" }, { value: "sem_nota", label: "Sem nota" }]} value={notaCadastro} onChange={(valor) => setNotaCadastro(valor as "com_nota" | "sem_nota" | "")} size="lg" /></div>
            <label className="block text-sm font-semibold text-text-secondary">Referência de moto <span className="font-normal text-text-faint">(opcional; salva como observação)</span><input className={inputClass} value={compatibilidade} onChange={(e) => setCompatibilidade(e.target.value)} placeholder="Ex.: CG 160" /></label>
           </div> : <div className="space-y-2"><Combobox label="Peça existente" placeholder="Busque pelo nome ou código" options={pecas.map((peca) => ({ value: peca.id, label: `${peca.codigoLegado} · ${peca.nome}` }))} value={pecaId} onChange={(valor) => { setPecaId(valor); setErroEtapa(null); }} size="lg" /><span className="block text-xs font-normal text-text-faint">O catálogo continua com um único nome; você só registra outra unidade.</span></div>}
          {erroEtapa && <p role="alert" className="text-sm font-medium text-danger">{erroEtapa}</p>}
        </section>}

        {etapa === 1 && <section className="space-y-4"><div><p className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">2 · Ficha da unidade</p><h3 className="mt-1 text-lg font-semibold">Detalhes desta peça física</h3><p className="mt-1 text-sm text-text-muted">Preço e condição podem ser diferentes de outra unidade com o mesmo nome.</p></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-text-secondary">Preço de venda<input ref={precoRef} aria-label="Preço da unidade" className={inputClass} type="number" min="0.01" step="0.01" value={preco} onChange={(e) => setPreco(e.target.value)} placeholder={operacional ? "Obrigatório" : "Pode definir depois"} /></label><fieldset><legend className="text-sm font-semibold text-text-secondary">Condição</legend><div className="mt-1 grid grid-cols-3 gap-2">{(["A", "B", "C"] as GrauUnidade[]).map((opcao) => <button key={opcao} type="button" aria-pressed={grau === opcao} onClick={() => setGrau(opcao)} className={`h-11 cursor-pointer rounded-control border text-sm font-semibold transition ${grau === opcao ? "border-accent/40 bg-accent-soft-bg text-accent-soft-fg" : "border-border-default bg-surface-inset text-text-muted hover:border-accent/30"}`}>Grau {opcao}</button>)}</div></fieldset></div><label className="block text-sm font-semibold text-text-secondary">Origem <span className="font-normal text-text-faint">(opcional)</span><input className={inputClass} value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Ex.: lote, moto doadora ou não identificada" /></label><EstoqueUploadFotos imagens={[]} onRemoverImagem={() => {}} onArquivosSelecionados={(files) => setFotos((atuais) => [...atuais, ...files])} enviando={salvando} resumoCompressao={null} />{fotos.length > 0 && <ul className="space-y-1 text-xs text-text-secondary">{fotos.map((foto, indice) => <li key={`${foto.name}-${indice}`} className="flex items-center justify-between gap-3 rounded-control bg-surface-inset pl-3"><span className="truncate">{foto.name}</span><button type="button" aria-label={`Remover ${foto.name}`} disabled={salvando} onClick={() => setFotos((atuais) => atuais.filter((_, i) => i !== indice))} className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-control px-3 font-semibold text-danger transition hover:bg-danger-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30 disabled:opacity-50"><X size={14} />Remover</button></li>)}</ul>}<p className="text-xs text-text-muted">As fotos desta unidade serão enviadas ao salvar. A foto geral do catálogo permanece separada.</p></section>}

        {etapa === 2 && <section className="space-y-4"><div><p className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">3 · Guardar</p><h3 className="mt-1 text-lg font-semibold">Onde ela ficará?</h3><p className="mt-1 text-sm text-text-muted">Escolha a prateleira e a seção. Se ainda não souber, deixe sem endereço e organize depois.</p></div><Combobox buttonRef={enderecoRef} label="Prateleira e seção" placeholder="Para organizar depois" options={enderecos} value={endereco} onChange={setEndereco} size="lg" />{operacional && !enderecos.length && <p className="text-sm text-text-muted">Nenhum local cadastrado. Cadastre uma prateleira no Mapa físico ou deixe para organizar depois.</p>}</section>}

        {etapa === 3 && <section className="space-y-4"><div><p className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">4 · Conferir</p><h3 className="mt-1 text-lg font-semibold">Revise antes de cadastrar</h3><p className="mt-1 text-sm text-text-muted">Você poderá editar esta unidade depois, sem criar outra peça no catálogo.</p></div><dl className="divide-y divide-border-subtle rounded-control border border-border-default text-sm"><div className="flex justify-between gap-4 p-3"><dt className="text-text-muted">Peça</dt><dd className="text-right font-semibold text-text-primary">{modo === "nova" ? nome : pecaEscolhida?.nome}</dd></div><div className="flex justify-between gap-4 p-3"><dt className="text-text-muted">Categoria</dt><dd className="text-right font-semibold text-text-primary">{categorias.find((categoria) => categoria.id === (modo === "nova" ? categoriaId : pecaEscolhida?.categoriaId))?.nome ?? "Não definida"}</dd></div><div className="flex justify-between gap-4 p-3"><dt className="text-text-muted">Preço e condição</dt><dd className="font-semibold text-text-primary">{preco ? `R$ ${preco}` : "A definir"} · Grau {grau}</dd></div><div className="flex justify-between gap-4 p-3"><dt className="text-text-muted">Origem</dt><dd className="font-semibold text-text-primary">{origem || "Não identificada"}</dd></div><div className="flex justify-between gap-4 p-3"><dt className="text-text-muted">Local</dt><dd className="font-semibold text-text-primary">{enderecoNormalizado ?? "Para organizar"}</dd></div></dl></section>}
        {etapa === 3 && <p className="text-xs text-text-muted">{fotos.length} {fotos.length === 1 ? "foto selecionada" : "fotos selecionadas"}{modo === "nova" ? ` · ${condicaoOrigem === "original" ? "Original" : "Paralela"}${notaCadastro ? ` · ${notaCadastro === "com_nota" ? "Com nota" : "Sem nota"}` : ""}` : ""}</p>}

        <ol className="grid grid-cols-4 gap-1 border-t border-border-subtle pt-4 text-center text-[10px] font-semibold uppercase tracking-wide text-text-faint">{["Peça", "Unidade", "Local", "Conferir"].map((nomeEtapa, indice) => <li key={nomeEtapa} className={indice === etapa ? "text-accent-soft-fg" : ""}>{indice + 1}. {nomeEtapa}</li>)}</ol>
        {erroSalvar && <p role="alert" className="rounded-control border border-danger/30 bg-danger-bg p-3 text-sm text-danger">{erroSalvar}</p>}
        <footer className="flex items-center justify-between gap-3"><button type="button" disabled={salvando} onClick={() => cadastroParcial || !etapa ? onFechar() : setEtapa((atual) => atual - 1)} className="h-11 cursor-pointer rounded-control px-3 text-sm font-medium text-text-muted transition hover:bg-surface-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:opacity-50">{cadastroParcial ? "Fechar e conferir" : etapa ? "Voltar" : "Cancelar"}</button>{!cadastroParcial && (etapa < 3 ? <button type="button" onClick={proxima} className="h-11 cursor-pointer rounded-control bg-accent px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[.98]">Próximo</button> : <button type="button" disabled={salvando} onClick={() => void salvar()} className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-control bg-accent px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60">{salvando ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}{salvando ? "Salvando…" : "Salvar unidade"}</button>)}</footer>
      </div>
    </InventoryDrawer>
  );
}
