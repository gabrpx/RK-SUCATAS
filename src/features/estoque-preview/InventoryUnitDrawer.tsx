import { Archive, BookmarkCheck, BookmarkX, Camera, CheckCircle2, History, Loader2, Pencil, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Tabs, TabsContent, TabsContents, TabsList, TabsTrigger } from "@/src/components/animate-ui/components/animate/tabs";
import { Combobox } from "@/src/components/ui/Combobox";
import { CurrencyInput } from "@/src/components/ui/CurrencyInput";
import { InventoryDrawer } from "./InventoryDrawer";
import { SeletorCliente } from "@/src/features/clientes/SeletorCliente";
import { InventoryPhotoGallery } from "./InventoryPhotoGallery";
import { EstoqueUploadFotos } from "@/src/features/estoque/EstoqueUploadFotos";
import type { Cliente } from "@/src/features/clientes/types";
import type { EventoHistorico, RecursosOrganizacao } from "./organizacaoApi";
import {
  DIAS_RESERVA_MAXIMO, DIAS_RESERVA_PADRAO, PERCENTUAL_SINAL_MINIMO, diasRestantesReserva, enderecosPrateleira,
  motivoBloqueioReserva, sinalMinimo, vencimentoReserva,
  type GrauUnidade, type PecaEstoque, type ReservaUnidadeInput, type UnidadeEstoque,
} from "./inventoryPreviewModel";

export interface HistoricoCarregado {
  eventos: EventoHistorico[];
  autoriaRegistrada: boolean;
  /** Demonstração local: eventos só desta sessão, nada vem do banco. */
  demonstracao?: boolean;
}

interface InventoryUnitDrawerProps {
  unidade: UnidadeEstoque | null;
  peca: PecaEstoque | null;
  onFechar: () => void;
  onSalvar: (alteracoes: UnidadeAlteracoes) => Promise<boolean | void> | boolean | void;
  onArquivar: () => void;
  abrirEmEdicao?: boolean;
  enderecos?: { value: string; label: string }[];
  operacional?: boolean;
  /** Pode arquivar (permissão + conexão). */
  podeArquivar?: boolean;
  /** Pode alterar a ficha (permissão `estoque.editar` + conexão confirmada). */
  podeAlterar?: boolean;
  /** Reservar/liberar só aparece quando a tela consegue gravar (demo ou conexão real confirmada). */
  reservasHabilitadas?: boolean;
  recursos?: RecursosOrganizacao;
  clientes?: Cliente[];
  formasPagamento?: { id: string; nome: string }[];
  onReservar?: (reserva: ReservaUnidadeInput) => Promise<boolean> | boolean;
  onLiberarReserva?: () => Promise<boolean> | boolean;
  carregarHistorico?: (unidade: UnidadeEstoque) => Promise<HistoricoCarregado>;
}

export interface UnidadeAlteracoes extends Partial<Pick<UnidadeEstoque, "preco" | "grau" | "origem" | "endereco">> {
  fotos?: string[];
  fotosNovas?: File[];
}

type AbaDetalhe = "visao-geral" | "historico";
type ModoDrawer = "detalhe" | "editar" | "reservar";
const inputClass = "mt-1 h-11 w-full rounded-control font-normal border border-border-default bg-surface-inset px-3 text-base text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-60";
const botaoSecundario = "inline-flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-control border border-border-default bg-surface-card px-3 text-sm font-medium text-text-secondary transition hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50";
const botaoPrimario = "inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-control bg-accent px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50";

function moeda(valor: number | null) { return valor === null ? "Preço a definir" : valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function dataCurta(iso: string) { return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }); }
function dataHora(iso: string) { return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
function numeroBr(valor: string) { const normalizado = valor.replace(/\./g, "").replace(",", "."); return normalizado.trim() ? Number(normalizado) : NaN; }
function textoMoeda(valor: number) { return valor.toFixed(2).replace(".", ","); }

function estadoDaUnidade(unidade: UnidadeEstoque) {
  if (unidade.vendidaEm) return { label: "Vendida", classe: "bg-surface-inset text-text-secondary" };
  if (unidade.estado === "arquivada") return { label: "Arquivada", classe: "bg-surface-inset text-text-secondary" };
  if (unidade.estado === "reservada") return { label: "Reservada", classe: "bg-accent-soft-bg text-accent-soft-fg" };
  if (unidade.estado === "organizar" || !unidade.endereco) return { label: "Para organizar", classe: "bg-warning-bg text-warning" };
  return { label: "Disponível", classe: "bg-positive-bg text-positive" };
}

const transicaoModo = { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 }, transition: { duration: 0.16 } };

export function InventoryUnitDrawer({ unidade, peca, onFechar, onSalvar, onArquivar, abrirEmEdicao = false, enderecos = enderecosPrateleira, operacional = false, podeArquivar = true, podeAlterar = true, reservasHabilitadas = false, recursos = { clienteNaReserva: true, reservaComSinal: true }, clientes = [], formasPagamento = [], onReservar, onLiberarReserva, carregarHistorico }: InventoryUnitDrawerProps) {
  const [aba, setAba] = useState<AbaDetalhe>("visao-geral");
  const [modo, setModo] = useState<ModoDrawer>("detalhe");
  const [preco, setPreco] = useState("");
  const [grau, setGrau] = useState<GrauUnidade>("B");
  const [origem, setOrigem] = useState("");
  const [endereco, setEndereco] = useState("");
  const [fotosEdicao, setFotosEdicao] = useState<string[]>([]);
  const [fotosNovas, setFotosNovas] = useState<File[]>([]);
  const [fotosAlteradas, setFotosAlteradas] = useState(false);
  const [erroFotos, setErroFotos] = useState<string | null>(null);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [clienteNome, setClienteNome] = useState("");
  const [diasReserva, setDiasReserva] = useState(String(DIAS_RESERVA_PADRAO));
  const [valorSinal, setValorSinal] = useState("");
  const [formaPagamentoId, setFormaPagamentoId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [historico, setHistorico] = useState<{ estado: "ocioso" | "carregando" | "pronto" | "erro"; dados?: HistoricoCarregado; erro?: string }>({ estado: "ocioso" });

  useEffect(() => {
    setAba("visao-geral"); setModo(abrirEmEdicao && unidade?.individualizada !== false && unidade?.estado !== "arquivada" && !unidade?.vendidaEm ? "editar" : "detalhe");
    setPreco(unidade?.preco?.toString() ?? ""); setGrau(unidade?.grau ?? "B");
    setOrigem(unidade?.origem ?? ""); setEndereco(unidade?.endereco ?? "");
    setFotosEdicao(unidade?.fotos?.filter(Boolean) ?? (unidade?.fotoUrl ? [unidade.fotoUrl] : []));
    setFotosNovas([]); setFotosAlteradas(false); setErroFotos(null);
    setClienteId(null); setClienteNome(""); setDiasReserva(String(DIAS_RESERVA_PADRAO));
    setValorSinal(unidade?.preco ? textoMoeda(sinalMinimo(unidade.preco)) : ""); setFormaPagamentoId("");
    setEnviando(false); setHistorico({ estado: "ocioso" });
  }, [unidade?.id, abrirEmEdicao]);

  // A linha do tempo é recarregada sempre que a aba é aberta, para refletir
  // reservas/arquivamentos feitos nesta mesma sessão.
  useEffect(() => {
    if (aba !== "historico" || !unidade || !carregarHistorico) return;
    let ativo = true;
    setHistorico((atual) => ({ estado: "carregando", dados: atual.dados }));
    carregarHistorico(unidade)
      .then((dados) => { if (ativo) setHistorico({ estado: "pronto", dados }); })
      .catch((erro) => { if (ativo) setHistorico({ estado: "erro", erro: erro instanceof Error ? erro.message : "Não foi possível carregar o histórico." }); });
    return () => { ativo = false; };
  }, [aba, unidade?.id, unidade?.estado, unidade?.reservaId, carregarHistorico]);

  if (!unidade || !peca) return null;
  const estado = estadoDaUnidade(unidade);
  const fotosDaUnidade = unidade.fotos?.filter(Boolean) ?? (unidade.fotoUrl ? [unidade.fotoUrl] : []);
  const fotos = fotosDaUnidade.length ? fotosDaUnidade : peca.fotos?.filter(Boolean) ?? [];
  const origemDasFotos = fotosDaUnidade.length ? "unidade" : "produto";
  const podeEditar = podeAlterar && unidade.individualizada !== false && unidade.estado !== "arquivada" && !unidade.vendidaEm;
  const clientesReservaveis = clientes.filter((cliente) => cliente.ativo && !cliente.banido);
  const diasNumero = Number(diasReserva);
  const diasValidos = Number.isInteger(diasNumero) && diasNumero >= 1 && diasNumero <= DIAS_RESERVA_MAXIMO;
  const nomeValido = Boolean(clienteId) || clienteNome.trim().length >= 2;
  const minimo = unidade.preco ? sinalMinimo(unidade.preco) : null;
  const sinalNumero = numeroBr(valorSinal);
  const sinalValido = minimo != null && Number.isFinite(sinalNumero) && sinalNumero >= minimo && sinalNumero <= (unidade.preco ?? 0);
  const bloqueioReserva = motivoBloqueioReserva(unidade);
  const reservaInstalada = recursos.reservaComSinal;
  const reservaPronta = reservaInstalada && diasValidos && nomeValido && sinalValido && Boolean(formaPagamentoId) && !enviando;
  const mostrarReservar = reservasHabilitadas && podeAlterar && Boolean(onReservar) && unidade.individualizada !== false && unidade.estado !== "arquivada" && unidade.estado !== "reservada" && !unidade.vendidaEm;
  const vencimentoPrevisto = diasValidos ? vencimentoReserva(diasNumero) : null;
  const precoInvalido = operacional && (!Number.isFinite(Number(preco)) || Number(preco) <= 0);

  const confirmarReserva = async () => {
    if (!reservaPronta || !onReservar) return;
    setEnviando(true);
    const cliente = clienteId ? clientesReservaveis.find((item) => item.id === clienteId) : undefined;
    try {
      const ok = await onReservar({ clienteId, nome: clienteNome.trim(), telefone: cliente?.telefone ?? null, dias: diasNumero, valorSinal: Math.round(sinalNumero * 100) / 100, formaPagamentoId });
      if (ok) setModo("detalhe");
    } finally { setEnviando(false); }
  };
  const liberar = async () => {
    if (!onLiberarReserva || enviando) return;
    setEnviando(true);
    try { await onLiberarReserva(); } finally { setEnviando(false); }
  };
  const salvar = async () => {
    if (precoInvalido || enviando) return;
    setEnviando(true);
    try {
      const resultado = await onSalvar({
        preco: preco.trim() ? Number(preco) : null,
        grau,
        origem: origem.trim() || null,
        endereco: endereco.trim() || null,
        ...(fotosAlteradas ? { fotos: fotosEdicao, fotosNovas } : {}),
      });
      if (resultado !== false) { setFotosNovas([]); setFotosAlteradas(false); }
    }
    finally { setEnviando(false); }
  };

  const formularioReserva = <section aria-labelledby="reservar-unidade" className="space-y-5">
    <div>
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-soft-fg">Reservar unidade</p>
      <h3 id="reservar-unidade" className="mt-1 text-lg font-semibold">Separe esta peça com sinal pago</h3>
      <p className="mt-1 text-sm text-text-muted">A reserva só vale com sinal de no mínimo {PERCENTUAL_SINAL_MINIMO}% do preço. A unidade continua no endereço físico e fica bloqueada para venda até ser liberada ou vencer.</p>
    </div>
    {!reservaInstalada && <p role="alert" className="rounded-control border border-warning/30 bg-warning/10 p-3 text-sm text-text-primary">A reserva com sinal ainda não está instalada no banco (migrations 067 e 068 pendentes). Peça ao responsável para aplicá-las; até lá nenhuma reserva real pode ser criada.</p>}
    <div>
      <p className="text-sm font-semibold text-text-secondary">Cliente</p>
      <SeletorCliente className="mt-1" ariaLabel="Cliente da reserva" clientes={recursos.clienteNaReserva ? clientesReservaveis : []} clienteId={clienteId} nome={clienteNome} onChange={(id, nome) => { setClienteId(id); setClienteNome(nome); }} placeholder={recursos.clienteNaReserva ? "Busque pelo nome ou telefone" : "Nome de quem reservou"} />
      <p className="mt-1.5 text-xs text-text-muted">{!recursos.clienteNaReserva ? "Vínculo com cadastro indisponível até a migration 067: a reserva fica só com o nome." : clienteId ? "Cliente cadastrado vinculado à reserva." : clienteNome.trim() ? "Sem cadastro: a reserva fica só com este nome. Escolha uma sugestão para vincular o cliente." : "Escolha um cliente cadastrado ou digite o nome de quem reservou."}</p>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-semibold text-text-secondary">Sinal pago (R$)
        <CurrencyInput aria-label="Valor do sinal" size="lg" value={valorSinal ? Math.round(numeroBr(valorSinal) * 100) : null} onChange={(centavos) => setValorSinal(centavos == null ? "" : textoMoeda(centavos / 100))} />
        <span className={`mt-1.5 block text-xs font-normal ${valorSinal && !sinalValido ? "text-danger" : "text-text-muted"}`}>{minimo != null && unidade.preco != null ? `Mínimo ${moeda(minimo)} (${PERCENTUAL_SINAL_MINIMO}% de ${moeda(unidade.preco)}); máximo ${moeda(unidade.preco)}.` : "Defina o preço da unidade primeiro."}</span>
      </label>
      <div className="text-sm font-semibold text-text-secondary">
        <Combobox label="Forma de pagamento do sinal" placeholder="Escolha a forma" options={formasPagamento.map((forma) => ({ value: forma.id, label: forma.nome }))} value={formaPagamentoId} onChange={setFormaPagamentoId} size="lg" />
        {!formasPagamento.length && <span className="mt-1.5 block text-xs font-normal text-text-muted">Nenhuma forma à vista carregada. Cadastre em Configurações.</span>}
      </div>
    </div>
    <label className="block text-sm font-semibold text-text-secondary">Prazo da reserva (dias)
      <input aria-label="Prazo da reserva em dias" type="number" min={1} max={DIAS_RESERVA_MAXIMO} step={1} className={inputClass} value={diasReserva} onChange={(event) => setDiasReserva(event.target.value)} />
      <span className="mt-1.5 block text-xs font-normal text-text-muted">{vencimentoPrevisto ? `Vence em ${dataHora(vencimentoPrevisto)} (${diasNumero} × 24 h a partir de agora).` : `Informe de 1 a ${DIAS_RESERVA_MAXIMO} dias.`}</span>
    </label>
  </section>;

  const formularioEdicao = <section aria-labelledby="editar-unidade" className="space-y-5">
    <div><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-soft-fg">Editar unidade</p><h3 id="editar-unidade" className="mt-1 text-lg font-semibold">Altere somente o que mudou nesta peça física</h3></div>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold text-text-secondary">Preço de venda<CurrencyInput aria-label="Preço da unidade" size="lg" value={preco ? Math.round(Number(preco) * 100) : null} onChange={(centavos) => setPreco(centavos == null ? "" : String(centavos / 100))} placeholder={operacional ? "Obrigatório" : "Pode definir depois"} /></label>
      <fieldset><legend className="text-sm font-semibold text-text-secondary">Condição</legend><div className="mt-1 grid grid-cols-3 gap-2">{(["A", "B", "C"] as const).map((opcao) => <button key={opcao} type="button" aria-pressed={grau === opcao} onClick={() => setGrau(opcao)} className={`h-11 cursor-pointer rounded-control border text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 active:scale-[.98] ${grau === opcao ? "border-accent/40 bg-accent-soft-bg text-accent-soft-fg" : "border-border-default bg-surface-inset text-text-muted hover:border-accent/30"}`}>Grau {opcao}</button>)}</div></fieldset>
    </div>
    <label className="block text-sm font-semibold text-text-secondary">Origem <span className="font-normal text-text-faint">(opcional)</span><input className={inputClass} value={origem} onChange={(event) => setOrigem(event.target.value)} placeholder="Não identificada" /></label>
    <Combobox label="Prateleira e seção" placeholder="Para organizar depois" options={enderecos} value={endereco} onChange={setEndereco} size="lg" />
    {operacional && <section className="space-y-3 rounded-control border border-border-default bg-surface-card p-4">
      <div><p className="text-sm font-semibold text-text-secondary">Fotos desta unidade</p><p className="mt-1 text-xs text-text-muted">Adicione, remova ou substitua as fotos depois do cadastro. A foto geral da peça continua como referência.</p></div>
      <EstoqueUploadFotos
        imagens={fotosEdicao}
        onRemoverImagem={(url) => { setFotosEdicao((atuais) => atuais.filter((foto) => foto !== url)); setFotosAlteradas(true); }}
        onArquivosSelecionados={(arquivos) => {
          if (fotosEdicao.length + fotosNovas.length + arquivos.length > 10) { setErroFotos("Cada unidade pode ter até 10 fotos."); return; }
          setErroFotos(null);
          setFotosNovas((atuais) => [...atuais, ...arquivos]);
          setFotosAlteradas(true);
        }}
        enviando={enviando}
        resumoCompressao={null}
      />
      {fotosNovas.length > 0 && <ul className="space-y-1 text-xs text-text-secondary">{fotosNovas.map((foto, indice) => <li key={`${foto.name}-${indice}`} className="flex items-center justify-between gap-3 rounded-control bg-surface-inset pl-3"><span className="truncate">{foto.name}</span><button type="button" aria-label={`Remover ${foto.name}`} disabled={enviando} onClick={() => setFotosNovas((atuais) => atuais.filter((_, i) => i !== indice))} className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-control px-3 font-semibold text-danger transition hover:bg-danger-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30 disabled:opacity-50"><X size={14} />Remover</button></li>)}</ul>}
      {erroFotos && <p role="alert" className="text-xs text-danger">{erroFotos}</p>}
      {!fotosEdicao.length && !fotosNovas.length && (peca.fotos?.length ?? 0) > 0 && <p className="text-xs text-text-muted">Esta unidade ainda usa a foto geral da peça como referência.</p>}
    </section>}
    <p className="rounded-control border border-accent/15 bg-accent-soft-bg/50 p-3 text-sm leading-5 text-text-secondary">Se a localização ficar vazia, a unidade vai para “Para organizar”. Origem desconhecida é uma informação válida.</p>
  </section>;

  const linhaDoTempo = <section className="rounded-control border border-border-default bg-surface-card p-4">
    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">Histórico da unidade</p>
    <h3 className="mt-1 text-lg font-semibold">Linha do tempo registrada</h3>
    <p className="mt-1 text-sm text-text-muted">{historico.dados?.demonstracao ? "Demonstração: mostra só o que foi feito nesta sessão; nada é gravado." : historico.dados && !historico.dados.autoriaRegistrada ? "Mostra datas gravadas no banco. Quem fez cada ação passa a ser registrado depois da migration 068." : "Eventos gravados no banco, do mais recente ao mais antigo."}</p>
    {historico.estado === "carregando" && !historico.dados && <p role="status" className="mt-4 flex items-center gap-2 text-sm text-text-muted"><Loader2 size={16} className="animate-spin" />Carregando histórico…</p>}
    {historico.estado === "erro" && <div role="alert" className="mt-4 rounded-control border border-danger/30 bg-danger-bg p-3 text-sm text-danger">{historico.erro} <button type="button" onClick={() => { setAba("visao-geral"); window.setTimeout(() => setAba("historico"), 0); }} className="ml-1 cursor-pointer font-semibold underline">Tentar novamente</button></div>}
    {historico.dados && (historico.dados.eventos.length ? <ol className="mt-5 space-y-5 border-l border-border-default pl-5 text-sm">{historico.dados.eventos.map((evento, indice) => <motion.li key={`${evento.tipo}-${evento.em}-${indice}`} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(indice, 6) * 0.03 }}>
      <strong className="text-text-primary">{evento.titulo}</strong>
      <p className="mt-0.5 text-xs text-text-muted">{dataHora(evento.em)} · {evento.autor ? `por ${evento.autor}` : "autor não registrado"}</p>
      {evento.detalhe && <p className="mt-1 text-text-secondary">{evento.detalhe}</p>}
    </motion.li>)}</ol> : <p className="mt-4 rounded-control border border-dashed border-border-default p-4 text-sm text-text-muted">{unidade.individualizada === false ? "Quantidade legada sem ficha física: ainda não há eventos." : "Nenhum evento registrado para esta unidade ainda."}</p>)}
    {!carregarHistorico && <p className="mt-4 text-sm text-text-muted">Histórico indisponível.</p>}
  </section>;

  const detalhe = <Tabs value={aba} onValueChange={(valor) => setAba(valor as AbaDetalhe)}>
    <TabsList variant="underline" aria-label="Seções da ficha" className="w-full justify-start"><TabsTrigger value="visao-geral">Visão geral</TabsTrigger><TabsTrigger value="historico"><History size={14} />Histórico</TabsTrigger></TabsList>
    <TabsContents><TabsContent value="visao-geral" className="pt-3"><div className="space-y-4">
      <AnimatePresence initial={false}>{unidade.estado === "reservada" && <motion.section key="reserva" aria-label="Reserva ativa" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="rounded-control border border-accent/25 bg-accent-soft-bg/60 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-soft-fg">Reserva ativa</p>
        <p className="mt-1 flex items-center gap-1.5 text-base font-semibold text-text-primary"><UserRound size={16} className="shrink-0 text-accent" /><span className="truncate">{unidade.reservadaPara || "Responsável não informado"}</span></p>
        <p className="mt-1 text-sm text-text-muted">{unidade.reservaClienteId ? "Cliente cadastrado" : "Sem cadastro de cliente"}{unidade.reservaTelefone ? ` · ${unidade.reservaTelefone}` : ""}</p>
        <p className="mt-1 text-sm text-text-secondary">{unidade.reservaValorSinal != null ? `Sinal de ${moeda(unidade.reservaValorSinal)} recebido` : "Sinal não registrado (reserva anterior à regra de 20%)"}</p>
        {unidade.reservadaAte && <p className="mt-1 text-sm text-text-secondary">Vence em {dataCurta(unidade.reservadaAte)} · {diasRestantesReserva(unidade.reservadaAte)} dias restantes</p>}
      </div>{reservasHabilitadas && podeAlterar && onLiberarReserva && unidade.reservaId && <button type="button" disabled={enviando} onClick={liberar} className={botaoSecundario}>{enviando ? <Loader2 size={16} className="animate-spin" /> : <BookmarkX size={16} />}Liberar reserva</button>}</div></motion.section>}</AnimatePresence>
      <section className="rounded-control border border-border-default bg-surface-card p-4"><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">Informações da unidade</p><h3 className="mt-1 text-lg font-semibold text-text-primary">{unidade.sku}</h3><div className="mt-4 grid grid-cols-2 gap-3 text-sm">{[["Preço", moeda(unidade.preco)], ["Localização", unidade.endereco ?? "Para organizar"], ["Origem", unidade.origem ?? "Não identificada"], ["Condição", `Grau ${unidade.grau}`]].map(([rotulo, valor]) => <div key={rotulo} className="rounded-control bg-surface-inset p-3"><span className="text-xs font-semibold text-text-muted">{rotulo}</span><strong className="mt-1 block text-text-primary">{valor}</strong></div>)}</div></section>
      <section className="rounded-control border border-border-default bg-surface-card p-4"><div className="flex items-center justify-between gap-4"><div><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">{fotos.length ? (origemDasFotos === "unidade" ? "Fotos da unidade" : "Fotos do produto") : "Fotos da unidade"}</p><p className="mt-1 text-sm text-text-muted">{origemDasFotos === "unidade" ? "Fotos desta peça física." : fotos.length ? "Referência geral; esta unidade não tem fotos próprias." : "Esta unidade e o produto ainda não têm fotos."}</p></div><Camera className="text-text-faint" size={20} /></div><InventoryPhotoGallery fotos={fotos} sku={unidade.sku} origem={origemDasFotos} /></section>
      <section className="rounded-control border border-border-default bg-surface-card p-4"><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">Detalhes da unidade</p><p className="mt-2 text-sm leading-6 text-text-secondary">{unidade.detalhes || peca.detalhes || "Nenhuma observação registrada."}</p></section>
    </div></TabsContent><TabsContent value="historico" className="pt-3">{linhaDoTempo}</TabsContent></TabsContents>
  </Tabs>;

  const rodapeEsquerda = modo !== "detalhe"
    ? <button type="button" onClick={() => setModo("detalhe")} className="h-11 cursor-pointer rounded-control px-3 text-sm font-medium text-text-muted transition hover:bg-surface-raised hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">Cancelar</button>
    : podeArquivar && podeEditar && unidade.estado !== "reservada"
      ? <button type="button" onClick={onArquivar} className="inline-flex h-11 cursor-pointer items-center gap-1 rounded-control px-3 text-sm font-medium text-danger transition hover:bg-danger-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30"><Archive size={16} />Arquivar</button>
      : <span className="text-xs text-text-muted">{unidade.individualizada === false ? "Sem ficha individual" : unidade.estado === "reservada" && podeAlterar ? "Libere a reserva para arquivar" : unidade.vendidaEm ? "Vendida · somente consulta" : unidade.estado === "arquivada" ? "Arquivada · restaure na aba Arquivados" : !podeAlterar ? "Somente consulta" : "Consulta"}</span>;

  const rodapeDireita = modo === "reservar"
    ? <button type="button" disabled={!reservaPronta} onClick={confirmarReserva} className={botaoPrimario}>{enviando ? <Loader2 size={16} className="animate-spin" /> : <BookmarkCheck size={16} />}{enviando ? "Reservando…" : "Confirmar reserva"}</button>
    : modo === "editar"
      ? <button type="button" disabled={precoInvalido || enviando} onClick={() => void salvar()} className={botaoPrimario}>{enviando ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}{enviando ? "Salvando…" : "Salvar alterações"}</button>
      : <div className="flex flex-wrap items-center justify-end gap-2">
        {mostrarReservar && (bloqueioReserva
          ? <span className="max-w-[16rem] text-right text-xs text-text-muted">{bloqueioReserva}{podeEditar && (unidade.preco == null || unidade.preco <= 0) && <button type="button" onClick={() => setModo("editar")} className="ml-1 cursor-pointer font-semibold text-accent underline">Definir preço</button>}</span>
          : <button type="button" onClick={() => setModo("reservar")} className={botaoSecundario}><BookmarkCheck size={16} />Reservar</button>)}
        {podeEditar && <button type="button" onClick={() => setModo("editar")} className={botaoPrimario}><Pencil size={16} />Editar unidade</button>}
      </div>;

  return <InventoryDrawer isOpen onClose={onFechar} title={`Detalhes da unidade ${unidade.sku}`} footer={<div className="flex flex-wrap items-center justify-between gap-3">{rodapeEsquerda}{rodapeDireita}</div>}>
    <div className="space-y-5">
      <header className="border-b border-border-subtle pb-4">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-soft-fg">Ficha da unidade</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-text-primary">{peca.nome}</h2>
        <p className="mt-1 text-sm text-text-muted">{unidade.codigoLegado} · {unidade.sku}</p>
        <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-surface-inset px-2.5 py-1 text-xs font-semibold text-text-secondary">{peca.compatibilidades.join(" · ") || "Compatibilidade a confirmar"}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${estado.classe}`}>{estado.label}</span><span className="rounded-full bg-surface-inset px-2.5 py-1 text-xs font-semibold text-text-secondary">Grau {unidade.grau}</span></div>
      </header>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={modo} {...transicaoModo}>{modo === "reservar" ? formularioReserva : modo === "editar" ? formularioEdicao : detalhe}</motion.div>
      </AnimatePresence>
    </div>
  </InventoryDrawer>;
}
