import { BadgeDollarSign, Check, ExternalLink, Link2, Loader2, Trash2, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { InventoryDrawer } from "./InventoryDrawer";
import { inventoryThumbnailUrl } from "./inventoryImageUrl";
import type { GrauUnidade, ResultadoBuscaEstoque, UnidadeEstoque } from "./inventoryPreviewModel";

export type PrecosPorGrau = Partial<Record<GrauUnidade, number>>;

const ORDEM_GRAUS: GrauUnidade[] = ["A", "B", "C"];

function semPreco(unidade: UnidadeEstoque) {
  return unidade.individualizada !== false
    && unidade.estado !== "arquivada"
    && !unidade.vendidaEm
    && !(Number(unidade.preco) > 0);
}

function lerPreco(valor: string) {
  const limpo = valor.trim().replace(/\s/g, "");
  if (!limpo) return null;
  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;
  const numero = Number(normalizado);
  if (!Number.isFinite(numero) || numero <= 0 || numero > 99_999_999) return null;
  const arredondado = Math.round(numero * 100) / 100;
  return arredondado > 0 ? arredondado : null;
}

function formatarPreco(preco: number | null) {
  return !(Number(preco) > 0) ? "Preço a definir" : Number(preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function status(unidade: UnidadeEstoque) {
  if (unidade.vendidaEm) return "Vendida";
  if (unidade.estado === "arquivada") return "Arquivada";
  if (unidade.estado === "reservada") return "Reservada";
  if (unidade.estado === "organizar" || !unidade.endereco) return "Para organizar";
  return "Disponível";
}

export function InventoryPieceSummaryDrawer({
  resultado,
  onClose,
  onOpenUnit,
  podeEditar = false,
  podeExcluir = false,
  onApplyPrices,
  onDeleteItem,
  onSaveFacebook,
  onAddMercadoLivre,
}: {
  resultado: ResultadoBuscaEstoque | null;
  onClose: () => void;
  onOpenUnit: (unidade: UnidadeEstoque) => void;
  podeEditar?: boolean;
  podeExcluir?: boolean;
  onApplyPrices?: (precos: PrecosPorGrau) => Promise<boolean>;
  onDeleteItem?: () => void;
  onSaveFacebook?: (url: string | null) => Promise<boolean>;
  onAddMercadoLivre?: (url: string) => Promise<boolean>;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const formId = useId();
  const reduzirMovimento = useReducedMotion();
  const [fade, setFade] = useState({ top: false, bottom: false });
  const [formularioAberto, setFormularioAberto] = useState(false);
  const [valores, setValores] = useState<Partial<Record<GrauUnidade, string>>>({});
  const [erros, setErros] = useState<Partial<Record<GrauUnidade, string>>>({});
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [facebook, setFacebook] = useState(resultado?.peca.anuncioFbUrl ?? "");
  const [novoMl, setNovoMl] = useState("");
  const [salvandoLink, setSalvandoLink] = useState(false);
  const unidadesOrdenadas = useMemo(() => resultado
    ? [...resultado.unidades].sort((a, b) => ({ A: 0, B: 1, C: 2 })[a.grau] - ({ A: 0, B: 1, C: 2 })[b.grau])
    : [], [resultado]);
  const unidadesSemPreco = useMemo(() => unidadesOrdenadas.filter(semPreco), [unidadesOrdenadas]);
  const grausSemPreco = useMemo(() => ORDEM_GRAUS.filter((grau) => unidadesSemPreco.some((unidade) => unidade.grau === grau)), [unidadesSemPreco]);
  const podePrecificarEmLote = podeEditar && Boolean(onApplyPrices) && unidadesSemPreco.length > 1;

  useEffect(() => {
    setFormularioAberto(false);
    setValores({});
    setErros({});
    setErroEnvio(null);
    setFacebook(resultado?.peca.anuncioFbUrl ?? "");
    setNovoMl("");
  }, [resultado?.peca.id]);

  useEffect(() => {
    const element = scroller.current;
    if (!element || !resultado) return;
    const atualizarFade = () => {
      const maximo = element.scrollHeight - element.clientHeight;
      setFade({ top: element.scrollTop > 2, bottom: maximo > 2 && element.scrollTop < maximo - 2 });
    };
    atualizarFade();
    window.addEventListener("resize", atualizarFade);
    return () => window.removeEventListener("resize", atualizarFade);
  }, [resultado, unidadesOrdenadas.length]);

  if (!resultado) return null;

  async function salvarFacebook() {
    if (!onSaveFacebook || salvandoLink) return;
    setSalvandoLink(true);
    try { if (await onSaveFacebook(facebook.trim() || null)) setFacebook(facebook.trim()); }
    finally { setSalvandoLink(false); }
  }
  async function adicionarMl() {
    if (!onAddMercadoLivre || !novoMl.trim() || salvandoLink) return;
    setSalvandoLink(true);
    try { if (await onAddMercadoLivre(novoMl.trim())) setNovoMl(""); }
    finally { setSalvandoLink(false); }
  }

  async function aplicarPrecos(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onApplyPrices || salvando) return;
    const proximosErros: Partial<Record<GrauUnidade, string>> = {};
    const precos: PrecosPorGrau = {};
    for (const grau of grausSemPreco) {
      const preco = lerPreco(valores[grau] ?? "");
      if (preco === null) proximosErros[grau] = "Informe um valor maior que zero.";
      else precos[grau] = preco;
    }
    setErros(proximosErros);
    setErroEnvio(null);
    if (Object.keys(proximosErros).length) return;
    setSalvando(true);
    try {
      const sucesso = await onApplyPrices(precos);
      if (sucesso) {
        setFormularioAberto(false);
        setValores({});
      } else {
        setErroEnvio("Não foi possível concluir todos os preços. Confira a conexão e tente novamente.");
      }
    } catch {
      setErroEnvio("Não foi possível concluir todos os preços. Os dados foram atualizados para refletir o servidor.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <InventoryDrawer isOpen onClose={onClose} title={`Unidades de ${resultado.peca.codigoLegado}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">{resultado.categoria.nome} · {resultado.peca.codigoLegado}</p>
          <h2 className="mt-1 text-lg font-semibold text-text-primary">{resultado.peca.nome}</h2>
          <p className="mt-1 text-xs text-text-muted">{resultado.peca.compatibilidades.join(" · ") || "Moto não informada"}</p>
        </div>
        <span className="shrink-0 rounded-full bg-surface-inset px-2.5 py-1 text-xs font-semibold text-text-secondary">{unidadesOrdenadas.length} {unidadesOrdenadas.length === 1 ? "unidade" : "unidades"}</span>
      </div>

      {(onSaveFacebook || onAddMercadoLivre) && <section className="mb-3 space-y-3 rounded-control border border-border-default bg-surface-inset/40 p-3" aria-label="Anúncios vinculados">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary"><Link2 size={16} /> Anúncios vinculados</div>
        {onSaveFacebook && <div className="flex gap-2"><input aria-label="Link do Facebook" type="url" value={facebook} onChange={(event) => setFacebook(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void salvarFacebook(); } }} placeholder="Link do Facebook Marketplace" className="min-w-0 flex-1 rounded-control border border-border-default bg-surface-card px-3 py-2 text-sm" /><button type="button" onClick={() => void salvarFacebook()} disabled={salvandoLink} className="min-h-11 rounded-control bg-accent px-3 text-sm font-semibold text-white disabled:opacity-50">Salvar</button></div>}
        {resultado.peca.anuncioFbUrl && <a href={resultado.peca.anuncioFbUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent-soft-fg"><ExternalLink size={12} /> Abrir Facebook</a>}
        {onAddMercadoLivre && <div className="flex gap-2"><input aria-label="Link do Mercado Livre" type="url" value={novoMl} onChange={(event) => setNovoMl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void adicionarMl(); } }} placeholder="Colar link do Mercado Livre" className="min-w-0 flex-1 rounded-control border border-border-default bg-surface-card px-3 py-2 text-sm" /><button type="button" onClick={() => void adicionarMl()} disabled={salvandoLink || !novoMl.trim()} className="min-h-11 rounded-control border border-border-default px-3 text-sm font-semibold text-text-secondary disabled:opacity-50">Adicionar</button></div>}
        {(resultado.peca.linksMl?.length ?? 0) > 0 && <div className="space-y-1">{resultado.peca.linksMl?.map((link) => <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-text-secondary hover:text-accent-soft-fg"><ExternalLink size={12} /> {link.mlb_id || link.url}</a>)}</div>}
      </section>}

      {podePrecificarEmLote && <div className="mb-3 border-y border-border-subtle py-3">
        <button
          type="button"
          aria-expanded={formularioAberto}
          aria-controls={`${formId}-formulario`}
          onClick={() => {
            setFormularioAberto((aberto) => !aberto);
            setErroEnvio(null);
          }}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-control px-1 text-left text-sm font-semibold text-accent transition-colors hover:text-accent-soft-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
        >
          <span className="inline-flex items-center gap-2"><BadgeDollarSign size={18} />Definir preços em lote</span>
          <span className="rounded-full bg-accent-soft-bg px-2.5 py-1 text-xs text-accent-soft-fg">{unidadesSemPreco.length} sem preço</span>
        </button>
        <AnimatePresence initial={false}>
          {formularioAberto && <motion.form
            id={`${formId}-formulario`}
            onSubmit={aplicarPrecos}
            initial={reduzirMovimento ? { opacity: 0 } : { opacity: 0, height: 0, y: -4 }}
            animate={reduzirMovimento ? { opacity: 1 } : { opacity: 1, height: "auto", y: 0 }}
            exit={reduzirMovimento ? { opacity: 0 } : { opacity: 0, height: 0, y: -2 }}
            transition={{ duration: reduzirMovimento ? 0.1 : 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-3">
              <p className="text-sm font-semibold text-text-primary">Um valor para cada estado da peça</p>
              <p className="mt-1 text-xs leading-5 text-text-muted">Só as unidades sem preço serão alteradas. Valores já definidos permanecem intactos.</p>
              <div className="mt-3 divide-y divide-border-subtle rounded-control border border-border-default bg-surface-inset/40 px-3">
                {grausSemPreco.map((grau, indice) => {
                  const quantidade = unidadesSemPreco.filter((unidade) => unidade.grau === grau).length;
                  const inputId = `${formId}-grau-${grau}`;
                  const erroId = `${inputId}-erro`;
                  return <motion.label
                    key={grau}
                    htmlFor={inputId}
                    initial={reduzirMovimento ? { opacity: 0 } : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18, delay: reduzirMovimento ? 0 : indice * 0.035 }}
                    className="grid gap-2 py-3 sm:grid-cols-[1fr_10rem] sm:items-center"
                  >
                    <span>
                      <span className="inline-flex items-center gap-2 font-semibold text-text-primary"><span className="grid size-7 place-items-center rounded-full bg-surface-card text-xs shadow-sm">{grau}</span>Grau {grau}</span>
                      <span className="mt-1 block text-xs text-text-muted">{quantidade} {quantidade === 1 ? "unidade sem preço" : "unidades sem preço"}</span>
                    </span>
                    <span>
                      <span className={`flex h-11 items-center rounded-control border bg-surface-card px-3 transition focus-within:ring-2 ${erros[grau] ? "border-danger focus-within:ring-danger/20" : "border-border-default focus-within:border-accent focus-within:ring-accent/20"}`}>
                        <span className="mr-2 text-sm font-semibold text-text-muted">R$</span>
                        <input
                          id={inputId}
                          name={`preco-${grau}`}
                          aria-label={`Preço do Grau ${grau}`}
                          aria-invalid={Boolean(erros[grau])}
                          aria-describedby={erros[grau] ? erroId : undefined}
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder="0,00"
                          value={valores[grau] ?? ""}
                          onChange={(event) => {
                            const valor = event.target.value;
                            setValores((atuais) => ({ ...atuais, [grau]: valor }));
                            setErros((atuais) => ({ ...atuais, [grau]: undefined }));
                          }}
                          className="min-w-0 flex-1 bg-transparent text-right text-base font-semibold tabular-nums text-text-primary outline-none"
                        />
                      </span>
                      {erros[grau] && <span id={erroId} role="alert" className="mt-1 block text-xs font-medium text-danger">{erros[grau]}</span>}
                    </span>
                  </motion.label>;
                })}
              </div>
              {erroEnvio && <motion.p role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 rounded-control bg-danger-bg px-3 py-2 text-xs font-medium text-danger">{erroEnvio}</motion.p>}
              <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" disabled={salvando} onClick={() => { setFormularioAberto(false); setErros({}); setErroEnvio(null); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-3 text-sm font-semibold text-text-secondary transition hover:bg-surface-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:opacity-50"><X size={16} />Cancelar</button>
                <button type="submit" disabled={salvando} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-accent px-4 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-wait disabled:opacity-60">{salvando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}{salvando ? "Aplicando preços…" : `Aplicar em ${unidadesSemPreco.length} unidades`}</button>
              </div>
            </div>
          </motion.form>}
        </AnimatePresence>
      </div>}

      {unidadesOrdenadas.length ? (
        <div className="relative">
          <div
            ref={scroller}
            role="list"
            aria-label={`Todas as unidades de ${resultado.peca.nome}, da melhor condição para a pior`}
            onScroll={(event) => {
              const element = event.currentTarget;
              const maximo = element.scrollHeight - element.clientHeight;
              setFade({ top: element.scrollTop > 2, bottom: maximo > 2 && element.scrollTop < maximo - 2 });
            }}
            className="max-h-[calc(100dvh-12rem)] space-y-2 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {unidadesOrdenadas.map((unidade, indice) => {
              const fotoPropria = unidade.fotos?.find(Boolean) ?? unidade.fotoUrl;
              const foto = fotoPropria || resultado.peca.fotos?.find(Boolean);
              const usandoFotoReferencia = !fotoPropria && Boolean(foto);
              return <motion.div key={unidade.id} role="listitem" layout="position" initial={reduzirMovimento ? { opacity: 0 } : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: reduzirMovimento ? 0 : Math.min(indice, 4) * 0.025 }}>
                <button
                  type="button"
                  onClick={() => onOpenUnit(unidade)}
                  aria-label={`Abrir ${unidade.sku}, Grau ${unidade.grau}, ${formatarPreco(unidade.preco)}, ${status(unidade)}`}
                  className="flex min-h-24 w-full cursor-pointer items-center gap-3 rounded-control border border-border-default bg-surface-card p-3 text-left shadow-sm transition hover:border-accent/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                >
                <div className="relative grid w-20 aspect-[4/3] shrink-0 place-items-center overflow-hidden rounded-control border border-border-default bg-surface-inset text-center text-[10px] font-medium text-text-faint">
                  {foto ? <img src={inventoryThumbnailUrl(foto)} alt={usandoFotoReferencia ? `Foto de referência de ${unidade.sku}` : `Foto de ${unidade.sku}`} loading="lazy" decoding="async" className="size-full bg-surface-inset object-contain" onError={(event) => {
                    const imagem = event.currentTarget;
                    const miniatura = inventoryThumbnailUrl(foto);
                    if (miniatura !== foto && imagem.dataset.fallbackAttempted !== "true") {
                      imagem.dataset.fallbackAttempted = "true";
                      imagem.src = foto;
                    }
                  }} /> : "Sem foto"}
                  {usandoFotoReferencia && <span title="Foto geral da peça, não uma foto própria da unidade" className="pointer-events-none absolute bottom-0.5 left-0.5 rounded bg-surface-card/95 px-1 py-0.5 text-[8px] font-bold leading-none text-text-secondary shadow-sm">Ref.</span>}
                </div>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <strong className="text-sm text-text-primary">{unidade.sku}</strong>
                    <span className="rounded-full bg-surface-inset px-2 py-0.5 text-[10px] font-semibold text-text-secondary">Grau {unidade.grau}</span>
                  </span>
                  <AnimatePresence mode="wait" initial={false}><motion.span key={`${unidade.id}-${unidade.preco}`} initial={reduzirMovimento ? { opacity: 0 } : { opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-1 block text-sm font-semibold tabular-nums text-text-primary">{formatarPreco(unidade.preco)}</motion.span></AnimatePresence>
                  <span className="mt-1 block truncate text-xs text-text-muted">{unidade.endereco ?? "Sem endereço"} · {unidade.origem ?? "Origem não identificada"}</span>
                  <span className="mt-1 block text-xs text-text-secondary">{status(unidade)}</span>
                </span>
                </button>
              </motion.div>;
            })}
          </div>
          {fade.top && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-8 bg-gradient-to-b from-surface-card via-surface-card/80 to-transparent" />}
          {fade.bottom && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-8 bg-gradient-to-t from-surface-card via-surface-card/80 to-transparent" />}
        </div>
      ) : (
        <p className="rounded-control border border-dashed border-border-default p-4 text-sm text-text-muted">Esta peça ainda não tem unidades físicas.</p>
      )}

      {podeExcluir && onDeleteItem && <div className="mt-4 flex flex-col gap-3 border-t border-border-subtle pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xs text-xs leading-5 text-text-muted">Exclui o cadastro inteiro{unidadesOrdenadas.length ? ` e suas ${unidadesOrdenadas.length} fichas` : " vazio"}. Esta ação exige confirmação.</p>
        <button type="button" onClick={onDeleteItem} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-3 text-sm font-semibold text-danger transition-colors hover:bg-danger-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30"><Trash2 size={16} />Excluir item do estoque</button>
      </div>}
    </InventoryDrawer>
  );
}
