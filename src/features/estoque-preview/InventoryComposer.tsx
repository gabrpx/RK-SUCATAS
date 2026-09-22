import { CheckCircle2, Layers3, PackagePlus, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { InventoryDrawer } from "./InventoryDrawer";
import type { CategoriaEstoque, GrauUnidade, NovaUnidadeInput, PecaEstoque } from "./inventoryPreviewModel";

interface InventoryComposerProps {
  aberto: boolean;
  categorias: CategoriaEstoque[];
  pecas: PecaEstoque[];
  onFechar: () => void;
  onSalvar: (entrada: NovaUnidadeInput) => void;
}

const inputClass = "mt-1 h-11 w-full rounded-control border border-border-default bg-surface-inset px-3 text-sm text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30";

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

export function InventoryComposer({ aberto, categorias, pecas, onFechar, onSalvar }: InventoryComposerProps) {
  const [etapa, setEtapa] = useState(0);
  const [modo, setModo] = useState<"nova" | "existente">("nova");
  const [pecaId, setPecaId] = useState(pecas[0]?.id ?? "");
  const [buscaPeca, setBuscaPeca] = useState(pecas[0] ? `${pecas[0].codigoLegado} · ${pecas[0].nome}` : "");
  const [nome, setNome] = useState("");
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? "");
  const [buscaCategoria, setBuscaCategoria] = useState(categorias[0]?.nome ?? "");
  const [compatibilidade, setCompatibilidade] = useState("");
  const [preco, setPreco] = useState("");
  const [grau, setGrau] = useState<GrauUnidade>("B");
  const [origem, setOrigem] = useState("");
  const [endereco, setEndereco] = useState("");
  const [erroEtapa, setErroEtapa] = useState<string | null>(null);

  const pecaEscolhida = pecas.find((peca) => peca.id === pecaId);
  const semelhantes = useMemo(() => modo === "nova" ? pecas.filter((peca) => saoSemelhantes(nome, peca)).slice(0, 3) : [], [modo, nome, pecas]);
  const enderecoNormalizado = endereco.trim() || null;

  function selecionarCategoria(valor: string) {
    setBuscaCategoria(valor);
    const categoria = categorias.find((item) => item.nome === valor);
    setCategoriaId(categoria?.id ?? "");
  }

  function selecionarPeca(valor: string) {
    setBuscaPeca(valor);
    const peca = pecas.find((item) => `${item.codigoLegado} · ${item.nome}` === valor);
    // Só uma escolha exata do catálogo pode anexar uma unidade existente.
    // Texto livre não herda a primeira peça da lista por acidente.
    setPecaId(peca?.id ?? "");
  }

  function usarExistente(peca: PecaEstoque) {
    setModo("existente");
    setPecaId(peca.id);
    setBuscaPeca(`${peca.codigoLegado} · ${peca.nome}`);
    setErroEtapa(null);
  }

  function validarEtapaAtual() {
    if (etapa !== 0) return true;
    if (modo === "existente" && pecaEscolhida) return true;
    if (modo === "nova" && nome.trim() && categoriaId) return true;
    setErroEtapa(modo === "nova" ? "Informe o nome e a categoria antes de continuar." : "Escolha a peça existente antes de continuar.");
    return false;
  }

  function salvar() {
    onSalvar({
      pecaId: modo === "existente" ? pecaId : undefined,
      novaPeca: modo === "nova" ? { nome: nome.trim(), categoriaId, compatibilidades: compatibilidade ? [compatibilidade.trim()] : [] } : undefined,
      preco: preco ? Number(preco) : null,
      grau,
      origem: origem.trim() || null,
      fotoUrl: null,
      endereco: enderecoNormalizado,
    });
    onFechar();
    setEtapa(0);
    setErroEtapa(null);
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
            {(["nova", "existente"] as const).map((opcao) => <button key={opcao} type="button" aria-pressed={modo === opcao} onClick={() => { setModo(opcao); setErroEtapa(null); }} className={`cursor-pointer rounded-control border p-3 text-left transition-colors ${modo === opcao ? "border-accent/40 bg-accent-soft-bg text-accent-soft-fg" : "border-border-default bg-surface-inset text-text-secondary hover:border-accent/30 hover:bg-surface-raised"}`}>
              <span className="flex items-center gap-2 font-semibold">{opcao === "nova" ? <PackagePlus size={16} /> : <Layers3 size={16} />}{opcao === "nova" ? "Criar peça" : "Usar existente"}</span>
              <span className="mt-1 block text-xs leading-5 text-text-muted">{opcao === "nova" ? "Ainda não existe este tipo no catálogo" : "Adicionar outra unidade a um nome já cadastrado"}</span>
            </button>)}
          </div>
          {modo === "nova" ? <div className="space-y-3">
            <label className="block text-sm font-semibold text-text-secondary">Nome da Peça<input aria-label="Nome da Peça" className={inputClass} value={nome} onChange={(e) => { setNome(e.target.value); setErroEtapa(null); }} placeholder="Ex.: suporte de placa CG 160" autoFocus /></label>
            {semelhantes.length > 0 && <section aria-live="polite" className="rounded-control border border-blue-200 bg-blue-50 p-3"><p className="flex items-center gap-2 text-sm font-semibold text-blue-900"><Sparkles size={16} />Já existe uma peça parecida</p><p className="mt-1 text-xs leading-5 text-blue-800">Para evitar dois cadastros do mesmo tipo, adicione esta unidade ao registro abaixo.</p><div className="mt-3 space-y-2">{semelhantes.map((peca) => <button type="button" key={peca.id} aria-label={`Usar existente: ${peca.codigoLegado}`} onClick={() => usarExistente(peca)} className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-control border border-blue-200 bg-white px-3 py-2 text-left text-sm transition hover:border-blue-400 hover:bg-blue-50"><span className="min-w-0"><strong className="block truncate text-text-primary">{peca.nome}</strong><span className="text-xs text-text-muted">{peca.codigoLegado} · {peca.compatibilidades.join(" · ") || "Moto não informada"}</span></span><span className="shrink-0 text-xs font-semibold text-blue-800">Usar existente</span></button>)}</div></section>}
            <label className="block text-sm font-semibold text-text-secondary">Categoria<input list="categorias-do-estoque" className={inputClass} value={buscaCategoria} onChange={(e) => selecionarCategoria(e.target.value)} placeholder="Digite ou escolha uma categoria" /><datalist id="categorias-do-estoque">{categorias.map((categoria) => <option key={categoria.id} value={categoria.nome} />)}</datalist></label>
            <label className="block text-sm font-semibold text-text-secondary">Moto compatível <span className="font-normal text-text-faint">(opcional)</span><input className={inputClass} value={compatibilidade} onChange={(e) => setCompatibilidade(e.target.value)} placeholder="Ex.: CG 160" /></label>
          </div> : <label className="block text-sm font-semibold text-text-secondary">Peça existente<div className="relative"><Search className="pointer-events-none absolute left-3 top-[60%] -translate-y-1/2 text-text-faint" size={16} /><input aria-label="Peça existente" list="pecas-do-estoque" className={`${inputClass} pl-9`} value={buscaPeca} onChange={(e) => { selecionarPeca(e.target.value); setErroEtapa(null); }} placeholder="Busque pelo nome ou código" /><datalist id="pecas-do-estoque">{pecas.map((peca) => <option key={peca.id} value={`${peca.codigoLegado} · ${peca.nome}`} />)}</datalist></div><span className="mt-1 block text-xs font-normal text-text-faint">O catálogo continua com um único nome; você só registra outra unidade.</span></label>}
          {erroEtapa && <p role="alert" className="text-sm font-medium text-danger">{erroEtapa}</p>}
        </section>}

        {etapa === 1 && <section className="space-y-4"><div><p className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">2 · Ficha da unidade</p><h3 className="mt-1 text-lg font-semibold">Detalhes desta peça física</h3><p className="mt-1 text-sm text-text-muted">Preço e condição podem ser diferentes de outra unidade com o mesmo nome.</p></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-text-secondary">Preço de venda<input aria-label="Preço da unidade" className={inputClass} type="number" value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="Pode definir depois" /></label><fieldset><legend className="text-sm font-semibold text-text-secondary">Condição</legend><div className="mt-1 grid grid-cols-3 gap-2">{(["A", "B", "C"] as GrauUnidade[]).map((opcao) => <button key={opcao} type="button" aria-pressed={grau === opcao} onClick={() => setGrau(opcao)} className={`h-11 cursor-pointer rounded-control border text-sm font-semibold transition ${grau === opcao ? "border-accent/40 bg-accent-soft-bg text-accent-soft-fg" : "border-border-default bg-surface-inset text-text-muted hover:border-accent/30"}`}>Grau {opcao}</button>)}</div></fieldset></div><label className="block text-sm font-semibold text-text-secondary">Origem <span className="font-normal text-text-faint">(opcional)</span><input className={inputClass} value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Ex.: lote, moto doadora ou não identificada" /></label><div className="rounded-control border border-dashed border-border-default bg-surface-inset p-3 text-sm text-text-muted"><strong className="text-text-secondary">Foto da unidade:</strong> poderá ser adicionada quando esta peça for conferida. Uma foto geral do cadastro não será repetida aqui.</div></section>}

        {etapa === 2 && <section className="space-y-4"><div><p className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">3 · Guardar</p><h3 className="mt-1 text-lg font-semibold">Onde ela ficará?</h3><p className="mt-1 text-sm text-text-muted">Se ainda não souber, deixe vazio. A unidade entra em “Para organizar” até receber endereço.</p></div><label className="block text-sm font-semibold text-text-secondary">Endereço físico <span className="font-normal text-text-faint">(opcional)</span><input className={inputClass} value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Ex.: P04-S02" /></label></section>}

        {etapa === 3 && <section className="space-y-4"><div><p className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">4 · Conferir</p><h3 className="mt-1 text-lg font-semibold">Revise antes de cadastrar</h3><p className="mt-1 text-sm text-text-muted">Você poderá editar esta unidade depois, sem criar outra peça no catálogo.</p></div><dl className="divide-y divide-border-subtle rounded-control border border-border-default text-sm"><div className="flex justify-between gap-4 p-3"><dt className="text-text-muted">Peça</dt><dd className="text-right font-semibold text-text-primary">{modo === "nova" ? nome : pecaEscolhida?.nome}</dd></div><div className="flex justify-between gap-4 p-3"><dt className="text-text-muted">Preço e condição</dt><dd className="font-semibold text-text-primary">{preco ? `R$ ${preco}` : "A definir"} · Grau {grau}</dd></div><div className="flex justify-between gap-4 p-3"><dt className="text-text-muted">Origem</dt><dd className="font-semibold text-text-primary">{origem || "Não identificada"}</dd></div><div className="flex justify-between gap-4 p-3"><dt className="text-text-muted">Local</dt><dd className="font-semibold text-text-primary">{enderecoNormalizado ?? "Para organizar"}</dd></div></dl></section>}

        <ol className="grid grid-cols-4 gap-1 border-t border-border-subtle pt-4 text-center text-[10px] font-semibold uppercase tracking-wide text-text-faint">{["Peça", "Unidade", "Local", "Conferir"].map((nomeEtapa, indice) => <li key={nomeEtapa} className={indice === etapa ? "text-accent-soft-fg" : ""}>{indice + 1}. {nomeEtapa}</li>)}</ol>
        <footer className="flex items-center justify-between gap-3"><button type="button" onClick={() => etapa ? setEtapa((atual) => atual - 1) : onFechar()} className="h-10 cursor-pointer rounded-control px-3 text-sm font-medium text-text-muted transition hover:bg-surface-raised hover:text-text-primary">{etapa ? "Voltar" : "Cancelar"}</button>{etapa < 3 ? <button type="button" onClick={proxima} className="h-10 cursor-pointer rounded-control bg-accent px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover">Próximo</button> : <button type="button" onClick={salvar} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-control bg-accent px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover"><CheckCircle2 size={16} />Salvar unidade</button>}</footer>
      </div>
    </InventoryDrawer>
  );
}
