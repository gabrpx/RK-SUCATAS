import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Loader2, Replace } from "lucide-react";
import { Combobox } from "@/src/components/ui/Combobox";
import { InventoryDrawer } from "./InventoryDrawer";
import type { BaixaPendente } from "./organizacaoApi";
import type { PecaEstoque, UnidadeEstoque } from "./inventoryPreviewModel";

const botao = "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-control border px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50";
const botaoSecundario = `${botao} border-border-default bg-surface-card text-text-secondary hover:border-accent/40 hover:text-accent`;

function moeda(valor: number | null | undefined) {
  return valor == null ? "sem valor" : valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataCurta(data: string | null | undefined) {
  if (!data) return "data não informada";
  const [ano, mes, dia] = data.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

/** Unidade física que pode ter sido a vendida: livre, com ficha própria e sem reserva. */
function podeTerSaido(unidade: UnidadeEstoque) {
  return unidade.individualizada !== false && !unidade.vendidaEm && unidade.estado !== "arquivada" && unidade.estado !== "reservada";
}

export interface PecaComSobra {
  peca: PecaEstoque;
  sobra: number;
  livres: UnidadeEstoque[];
}

/** Peças cuja quantidade ficou menor que as fichas livres (vendas antigas sem unidade). */
export function pecasComFichasSobrando(pecas: PecaEstoque[], unidades: UnidadeEstoque[]): PecaComSobra[] {
  return pecas
    .filter((peca) => (peca.fichasExcedentes ?? 0) > 0)
    .map((peca) => ({ peca, sobra: peca.fichasExcedentes ?? 0, livres: unidades.filter((unidade) => unidade.pecaId === peca.id && podeTerSaido(unidade)) }));
}

interface Props {
  aberto: boolean;
  onFechar: () => void;
  baixas: BaixaPendente[];
  sobras: PecaComSobra[];
  pecas: PecaEstoque[];
  unidades: UnidadeEstoque[];
  podeAlterar: boolean;
  onConferir: (baixa: BaixaPendente, unidadeCorretaId: string | null) => Promise<boolean>;
  onBaixarExcedente: (unidade: UnidadeEstoque) => Promise<boolean>;
}

function CartaoBaixa({ baixa, peca, unidade, alternativas, podeAlterar, onConferir }: {
  baixa: BaixaPendente;
  peca: PecaEstoque | null;
  unidade: UnidadeEstoque | null;
  alternativas: UnidadeEstoque[];
  podeAlterar: boolean;
  onConferir: Props["onConferir"];
}) {
  const [trocando, setTrocando] = useState(false);
  const [escolhida, setEscolhida] = useState("");
  const [enviando, setEnviando] = useState<"confirmar" | "trocar" | null>(null);
  const venda = baixa.venda;
  async function enviar(tipo: "confirmar" | "trocar") {
    setEnviando(tipo);
    try { await onConferir(baixa, tipo === "trocar" ? escolhida : null); } finally { setEnviando(null); }
  }
  return <motion.li layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 16 }} className="rounded-control border border-border-default bg-surface-card p-4">
    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-warning">Venda de {dataCurta(venda?.data)}{venda?.cliente_nome ? ` · ${venda.cliente_nome}` : ""}</p>
    <h3 className="mt-1 break-words text-base font-semibold text-text-primary">{peca?.nome ?? venda?.nome_item ?? "Peça"}</h3>
    <p className="mt-1 text-sm text-text-secondary">A venda foi registrada sem escolher a unidade. O sistema baixou a mais antiga:</p>
    <p className="mt-2 rounded-control bg-surface-inset px-3 py-2 text-sm text-text-primary"><strong>{unidade?.sku ?? "Unidade"}</strong> · {unidade?.endereco ?? "sem endereço"} · {moeda(unidade?.preco)}{venda?.valor_total != null ? <span className="text-text-muted"> · venda de {moeda(venda.valor_total)}</span> : null}</p>
    {podeAlterar ? <>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={Boolean(enviando)} onClick={() => void enviar("confirmar")} aria-label={`Confirmar que ${unidade?.sku ?? "a unidade"} foi a vendida`} className={botaoSecundario}>{enviando === "confirmar" ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}Foi esta</button>
        <button type="button" disabled={Boolean(enviando) || !alternativas.length} aria-expanded={trocando} onClick={() => setTrocando((valor) => !valor)} className={botaoSecundario}><Replace size={15} />Foi outra</button>
      </div>
      {!alternativas.length && <p className="mt-2 text-xs text-text-muted">Não há outra unidade livre desta peça para trocar.</p>}
      <AnimatePresence initial={false}>{trocando && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
        <div className="mt-3 grid gap-2">
          <Combobox size="lg" label="Unidade que realmente saiu" placeholder="Escolha a unidade" value={escolhida} onChange={setEscolhida} options={alternativas.map((item) => ({ value: item.id, label: `${item.sku} · ${item.endereco ?? "sem endereço"} · ${moeda(item.preco)}` }))} />
          <button type="button" disabled={!escolhida || Boolean(enviando)} onClick={() => void enviar("trocar")} className={botaoSecundario}>{enviando === "trocar" ? <Loader2 size={15} className="animate-spin" /> : <Replace size={15} />}Trocar e devolver {unidade?.sku ?? "a unidade"} ao estoque</button>
        </div>
      </motion.div>}</AnimatePresence>
    </> : <p className="mt-3 text-xs text-text-muted">Seu usuário não tem permissão para conferir baixas.</p>}
  </motion.li>;
}

function CartaoSobra({ sobra, podeAlterar, onBaixarExcedente }: { sobra: PecaComSobra; podeAlterar: boolean; onBaixarExcedente: Props["onBaixarExcedente"] }) {
  const [enviando, setEnviando] = useState<string | null>(null);
  async function baixar(unidade: UnidadeEstoque) {
    setEnviando(unidade.id);
    try { await onBaixarExcedente(unidade); } finally { setEnviando(null); }
  }
  return <motion.li layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 16 }} className="rounded-control border border-border-default bg-surface-card p-4">
    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-warning">{sobra.peca.codigoLegado}</p>
    <h3 className="mt-1 break-words text-base font-semibold text-text-primary">{sobra.peca.nome}</h3>
    <p className="mt-1 text-sm text-text-secondary">{sobra.sobra === 1 ? "1 ficha sobrando" : `${sobra.sobra} fichas sobrando`}: uma venda antiga baixou a quantidade sem dizer qual unidade saiu. Marque a que não está mais no galpão.</p>
    <ul className="mt-3 space-y-2">{sobra.livres.map((unidade) => <li key={unidade.id} className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-surface-inset px-3 py-2 text-sm">
      <span className="min-w-0"><strong>{unidade.sku}</strong> · {unidade.endereco ?? "sem endereço"} · {moeda(unidade.preco)}</span>
      {podeAlterar && <button type="button" disabled={Boolean(enviando)} onClick={() => void baixar(unidade)} aria-label={`Marcar ${unidade.sku} como já vendida`} className={botaoSecundario}>{enviando === unidade.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}Já saiu</button>}
    </li>)}</ul>
    {!sobra.livres.length && <p className="mt-2 text-xs text-text-muted">Todas as fichas livres estão reservadas. Libere a reserva que não vale mais.</p>}
  </motion.li>;
}

/**
 * Conferência de estoque: vendas registradas sem unidade (baixa automática da
 * migration_069) e fichas que sobraram de vendas antigas. Cada item tem uma
 * ação — nada aqui é só aviso.
 */
export function InventoryConferencia({ aberto, onFechar, baixas, sobras, pecas, unidades, podeAlterar, onConferir, onBaixarExcedente }: Props) {
  const porId = useMemo(() => new Map(unidades.map((unidade) => [unidade.id, unidade])), [unidades]);
  const pecaPorId = useMemo(() => new Map(pecas.map((peca) => [peca.id, peca])), [pecas]);
  const total = baixas.length + sobras.length;
  return <InventoryDrawer isOpen={aberto} onClose={onFechar} title="Conferência do estoque">
    {total === 0 ? <p className="rounded-control border border-dashed border-border-default p-6 text-center text-sm text-text-muted">Tudo conferido. Nenhuma venda sem unidade aguardando.</p> : null}
    {baixas.length > 0 && <section aria-labelledby="conferencia-baixas">
      <h2 id="conferencia-baixas" className="text-sm font-semibold text-text-primary">Vendas sem unidade escolhida <span className="text-text-muted">({baixas.length})</span></h2>
      <p className="mt-1 text-xs leading-5 text-text-muted">Confirme se a unidade baixada é a que saiu. Se foi outra, troque: a escolhida pelo sistema volta ao estoque.</p>
      <ul className="mt-3 space-y-3"><AnimatePresence initial={false}>{baixas.map((baixa) => {
        const unidade = porId.get(baixa.unidade_id) ?? null;
        return <CartaoBaixa key={baixa.id} baixa={baixa} unidade={unidade} peca={pecaPorId.get(baixa.estoque_id) ?? null}
          alternativas={unidades.filter((item) => item.pecaId === baixa.estoque_id && item.id !== baixa.unidade_id && podeTerSaido(item))}
          podeAlterar={podeAlterar} onConferir={onConferir} />;
      })}</AnimatePresence></ul>
    </section>}
    {sobras.length > 0 && <section aria-labelledby="conferencia-sobras" className={baixas.length ? "mt-6 border-t border-border-subtle pt-5" : ""}>
      <h2 id="conferencia-sobras" className="text-sm font-semibold text-text-primary">Fichas sobrando de vendas antigas <span className="text-text-muted">({sobras.length} {sobras.length === 1 ? "peça" : "peças"})</span></h2>
      <p className="mt-1 text-xs leading-5 text-text-muted">A quantidade da peça já foi baixada; só falta dizer qual unidade física saiu. Até lá, elas não contam como disponíveis.</p>
      <ul className="mt-3 space-y-3"><AnimatePresence initial={false}>{sobras.map((sobra) => <CartaoSobra key={sobra.peca.id} sobra={sobra} podeAlterar={podeAlterar} onBaixarExcedente={onBaixarExcedente} />)}</AnimatePresence></ul>
    </section>}
  </InventoryDrawer>;
}
