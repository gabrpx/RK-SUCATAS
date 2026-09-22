import { Archive, BookmarkCheck, BookmarkX, Camera, CheckCircle2, Pencil, Tag, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsContents, TabsList, TabsTrigger } from "@/src/components/animate-ui/components/animate/tabs";
import { Combobox } from "@/src/components/ui/Combobox";
import { InventoryDrawer } from "./InventoryDrawer";
import { SeletorCliente } from "@/src/features/clientes/SeletorCliente";
import type { Cliente } from "@/src/features/clientes/types";
import { DIAS_RESERVA_MAXIMO, DIAS_RESERVA_PADRAO, diasRestantesReserva, enderecosPrateleira, podeReservar, type GrauUnidade, type PecaEstoque, type ReservaUnidadeInput, type UnidadeEstoque } from "./inventoryPreviewModel";

interface InventoryUnitDrawerProps {
  unidade: UnidadeEstoque | null;
  peca: PecaEstoque | null;
  onFechar: () => void;
  onSalvar: (alteracoes: Partial<Pick<UnidadeEstoque, "preco" | "grau" | "origem" | "endereco">>) => void;
  onArquivar: () => void;
  abrirEmEdicao?: boolean;
  enderecos?: { value: string; label: string }[];
  operacional?: boolean;
  podeArquivar?: boolean;
  /** Reservar/liberar só aparece quando a tela consegue gravar (demo ou conexão real confirmada). */
  reservasHabilitadas?: boolean;
  clientes?: Cliente[];
  onReservar?: (reserva: ReservaUnidadeInput) => Promise<boolean> | boolean;
  onLiberarReserva?: () => Promise<boolean> | boolean;
}

type AbaDetalhe = "visao-geral" | "historico";
type ModoDrawer = "detalhe" | "editar" | "reservar";
const inputClass = "mt-1 h-11 w-full rounded-control border border-border-default bg-surface-inset px-3 text-base text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30";

function moeda(valor: number | null) { return valor === null ? "Preço a definir" : valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function dataCurta(iso: string) { return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }); }
function vencimentoEmDias(dias: number, agora = new Date()) {
  const data = new Date(agora);
  data.setDate(data.getDate() + dias);
  data.setHours(18, 0, 0, 0);
  return data.toISOString();
}

function estadoDaUnidade(unidade: UnidadeEstoque) {
  if (unidade.vendidaEm) return { label: "Vendida", classe: "bg-slate-100 text-slate-700" };
  if (unidade.estado === "arquivada") return { label: "Arquivada", classe: "bg-slate-100 text-slate-700" };
  if (unidade.estado === "reservada") return { label: "Reservada", classe: "bg-blue-50 text-blue-800" };
  if (unidade.estado === "organizar" || !unidade.endereco) return { label: "Para organizar", classe: "bg-violet-50 text-violet-800" };
  return { label: "Disponível", classe: "bg-emerald-50 text-emerald-800" };
}

export function InventoryUnitDrawer({ unidade, peca, onFechar, onSalvar, onArquivar, abrirEmEdicao = false, enderecos = enderecosPrateleira, operacional = false, podeArquivar = true, reservasHabilitadas = false, clientes = [], onReservar, onLiberarReserva }: InventoryUnitDrawerProps) {
  const [aba, setAba] = useState<AbaDetalhe>("visao-geral");
  const [modo, setModo] = useState<ModoDrawer>("detalhe");
  const [preco, setPreco] = useState("");
  const [grau, setGrau] = useState<GrauUnidade>("B");
  const [origem, setOrigem] = useState("");
  const [endereco, setEndereco] = useState("");
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [clienteNome, setClienteNome] = useState("");
  const [diasReserva, setDiasReserva] = useState(String(DIAS_RESERVA_PADRAO));
  const [enviandoReserva, setEnviandoReserva] = useState(false);

  useEffect(() => {
    setAba("visao-geral"); setModo(abrirEmEdicao && unidade?.individualizada !== false && unidade?.estado !== "arquivada" ? "editar" : "detalhe");
    setPreco(unidade?.preco?.toString() ?? ""); setGrau(unidade?.grau ?? "B");
    setOrigem(unidade?.origem ?? ""); setEndereco(unidade?.endereco ?? "");
    setClienteId(null); setClienteNome(""); setDiasReserva(String(DIAS_RESERVA_PADRAO)); setEnviandoReserva(false);
  }, [unidade?.id, abrirEmEdicao]);

  if (!unidade || !peca) return null;
  const estado = estadoDaUnidade(unidade);
  const podeEditar = unidade.individualizada !== false && unidade.estado !== "arquivada";
  const clientesReservaveis = clientes.filter((cliente) => cliente.ativo && !cliente.banido);
  const diasNumero = Number(diasReserva);
  const diasValidos = Number.isInteger(diasNumero) && diasNumero >= 1 && diasNumero <= DIAS_RESERVA_MAXIMO;
  const nomeValido = Boolean(clienteId) || clienteNome.trim().length >= 2;
  const reservaPronta = diasValidos && nomeValido && !enviandoReserva;
  const mostrarReservar = reservasHabilitadas && Boolean(onReservar) && podeReservar(unidade);
  const confirmarReserva = async () => {
    if (!reservaPronta || !onReservar) return;
    setEnviandoReserva(true);
    const cliente = clienteId ? clientesReservaveis.find((item) => item.id === clienteId) : undefined;
    try {
      const ok = await onReservar({ clienteId, nome: clienteNome.trim(), telefone: cliente?.telefone ?? null, reservadaAte: vencimentoEmDias(diasNumero) });
      if (ok) setModo("detalhe");
    } finally { setEnviandoReserva(false); }
  };
  const liberar = async () => {
    if (!onLiberarReserva || enviandoReserva) return;
    setEnviandoReserva(true);
    try { await onLiberarReserva(); } finally { setEnviandoReserva(false); }
  };
  const salvar = () => {
    if (operacional && (!Number.isFinite(Number(preco)) || Number(preco) <= 0)) return;
    onSalvar({ preco: preco.trim() ? Number(preco) : null, grau, origem: origem.trim() || null, endereco: endereco.trim() || null });
  };

  return <InventoryDrawer isOpen onClose={onFechar} title={`Detalhes da unidade ${unidade.sku}`}>
    <div className="space-y-5">
      <header className="border-b border-border-subtle pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-soft-fg">Ficha da unidade</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-text-primary">{peca.nome}</h2>
        <p className="mt-1 text-sm text-text-muted">{unidade.codigoLegado} · {unidade.sku}</p>
        <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-surface-inset px-2.5 py-1 text-xs font-semibold text-text-secondary">{peca.compatibilidades.join(" · ") || "Compatibilidade a confirmar"}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${estado.classe}`}>{estado.label}</span><span className="rounded-full bg-surface-inset px-2.5 py-1 text-xs font-semibold text-text-secondary">Grau {unidade.grau}</span></div>
      </header>

      {modo === "reservar" ? <section aria-labelledby="reservar-unidade" className="space-y-5"><div><p className="text-[11px] font-semibold uppercase tracking-wider text-accent-soft-fg">Reservar unidade</p><h3 id="reservar-unidade" className="mt-1 text-lg font-semibold">Separe esta peça para um cliente</h3><p className="mt-1 text-sm text-text-muted">A unidade continua no endereço físico e fica bloqueada para venda até a reserva ser liberada ou vencer.</p></div><div><p className="text-sm font-semibold text-text-secondary">Cliente</p><SeletorCliente className="mt-1" ariaLabel="Cliente da reserva" clientes={clientesReservaveis} clienteId={clienteId} nome={clienteNome} onChange={(id, nome) => { setClienteId(id); setClienteNome(nome); }} placeholder="Busque pelo nome ou telefone" /><p className="mt-1.5 text-xs text-text-muted">{clienteId ? "Cliente cadastrado vinculado à reserva." : clienteNome.trim() ? "Sem cadastro: a reserva fica só com este nome. Escolha uma sugestão para vincular o cliente." : "Escolha um cliente cadastrado ou digite o nome de quem reservou."}</p></div><label className="block text-sm font-semibold text-text-secondary">Prazo da reserva (dias)<input aria-label="Prazo da reserva em dias" type="number" min={1} max={DIAS_RESERVA_MAXIMO} step={1} className={inputClass} value={diasReserva} onChange={(event) => setDiasReserva(event.target.value)} /><span className="mt-1.5 block text-xs font-normal text-text-muted">{diasValidos ? `Vence em ${dataCurta(vencimentoEmDias(diasNumero))}, às 18h.` : `Informe de 1 a ${DIAS_RESERVA_MAXIMO} dias.`}</span></label></section> : modo === "editar" ? <section aria-labelledby="editar-unidade" className="space-y-5"><div><p className="text-[11px] font-semibold uppercase tracking-wider text-accent-soft-fg">Editar unidade</p><h3 id="editar-unidade" className="mt-1 text-lg font-semibold">Altere somente o que mudou nesta peça física</h3></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-text-secondary">Preço de venda<input aria-label="Preço da unidade" type="number" min="0.01" step="0.01" className={inputClass} value={preco} onChange={(event) => setPreco(event.target.value)} placeholder={operacional ? "Obrigatório" : "Pode definir depois"} /></label><fieldset><legend className="text-sm font-semibold text-text-secondary">Condição</legend><div className="mt-1 grid grid-cols-3 gap-2">{(["A", "B", "C"] as const).map((opcao) => <button key={opcao} type="button" aria-pressed={grau === opcao} onClick={() => setGrau(opcao)} className={`h-11 cursor-pointer rounded-control border text-sm font-semibold ${grau === opcao ? "border-accent/40 bg-accent-soft-bg text-accent-soft-fg" : "border-border-default bg-surface-inset text-text-muted hover:border-accent/30"}`}>Grau {opcao}</button>)}</div></fieldset></div><label className="block text-sm font-semibold text-text-secondary">Origem <span className="font-normal text-text-faint">(opcional)</span><input className={inputClass} value={origem} onChange={(event) => setOrigem(event.target.value)} placeholder="Não identificada" /></label><Combobox label="Prateleira e seção" placeholder="Para organizar depois" options={enderecos} value={endereco} onChange={setEndereco} /><p className="rounded-control border border-accent/15 bg-accent-soft-bg/50 p-3 text-sm leading-5 text-text-secondary">Se a localização ficar vazia, a unidade vai para “Para organizar”. Origem desconhecida é uma informação válida.</p></section> : <Tabs value={aba} onValueChange={(valor) => setAba(valor as AbaDetalhe)}>
        <TabsList variant="underline" aria-label="Seções da ficha" className="w-full justify-start"><TabsTrigger value="visao-geral">Visão geral</TabsTrigger><TabsTrigger value="historico">Histórico</TabsTrigger></TabsList>
        <TabsContents><TabsContent value="visao-geral" className="pt-3"><div className="space-y-4">{unidade.estado === "reservada" && <section aria-label="Reserva ativa" className="rounded-control border border-accent/25 bg-accent-soft-bg/60 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wider text-accent-soft-fg">Reserva ativa</p><p className="mt-1 flex items-center gap-1.5 text-base font-semibold text-text-primary"><UserRound size={16} className="shrink-0 text-accent" /><span className="truncate">{unidade.reservadaPara || "Responsável não informado"}</span></p><p className="mt-1 text-sm text-text-muted">{unidade.reservaClienteId ? "Cliente cadastrado" : "Sem cadastro de cliente"}{unidade.reservaTelefone ? ` · ${unidade.reservaTelefone}` : ""}</p>{unidade.reservadaAte && <p className="mt-1 text-sm text-text-secondary">Vence em {dataCurta(unidade.reservadaAte)} · {diasRestantesReserva(unidade.reservadaAte)} dias restantes</p>}</div>{reservasHabilitadas && onLiberarReserva && unidade.reservaId && <button type="button" disabled={enviandoReserva} onClick={liberar} className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1 rounded-control border border-border-default bg-surface-card px-3 text-sm font-medium text-text-secondary transition hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"><BookmarkX size={16} />Liberar reserva</button>}</div></section>}<section className="rounded-control border border-border-default bg-surface-card p-4"><p className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">Informações da unidade</p><h3 className="mt-1 text-lg font-semibold text-text-primary">{unidade.sku}</h3><div className="mt-4 grid grid-cols-2 gap-3 text-sm">{[["Preço", moeda(unidade.preco)], ["Localização", unidade.endereco ?? "Para organizar"], ["Origem", unidade.origem ?? "Não identificada"], ["Condição", `Grau ${unidade.grau}`]].map(([rotulo, valor]) => <div key={rotulo} className="rounded-control bg-surface-inset p-3"><span className="text-xs font-semibold text-text-muted">{rotulo}</span><strong className="mt-1 block text-text-primary">{valor}</strong></div>)}</div></section><section className="rounded-control border border-border-default bg-surface-card p-4"><div className="flex items-center justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">Foto da unidade</p><p className="mt-1 text-sm text-text-muted">Apenas a foto desta peça física aparece aqui.</p></div><Camera className="text-text-faint" size={20} /></div><div className="mt-4 grid h-40 place-items-center overflow-hidden rounded-control border border-dashed border-border-default bg-surface-inset text-sm font-semibold text-text-muted">{unidade.fotoUrl ? <img src={unidade.fotoUrl} alt={`Foto da unidade ${unidade.sku}`} className="h-full w-full object-cover" /> : "Ainda sem foto própria"}</div></section><section className="rounded-control border border-border-default bg-surface-card p-4"><p className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">Detalhes e compatibilidade</p><p className="mt-2 text-sm leading-6 text-text-secondary">{unidade.detalhes || peca.detalhes || "Nenhuma observação registrada."}</p><p className="mt-3 flex items-center gap-2 text-sm font-semibold text-text-secondary"><Tag size={16} className="text-accent" />{peca.compatibilidades.join(" · ") || "Compatibilidade a confirmar"}</p></section></div></TabsContent><TabsContent value="historico" className="pt-3"><section className="rounded-control border border-border-default bg-surface-card p-4"><p className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">Histórico da unidade</p><h3 className="mt-1 text-lg font-semibold">Rastreabilidade preservada</h3><ol className="mt-5 space-y-5 border-l border-border-default pl-5 text-sm"><li><strong className="text-text-primary">Ficha disponível na prévia</strong><p className="mt-1 text-text-muted">SKU {unidade.sku} representa uma única peça física.</p></li><li><strong className="text-text-primary">Estado atual: {estado.label}</strong><p className="mt-1 text-text-muted">{unidade.endereco ? `Localização atual: ${unidade.endereco}.` : "Aguardando definição de localização."}</p></li><li><strong className="text-text-primary">Próxima ação</strong><p className="mt-1 text-text-muted">{unidade.fotoUrl ? "Conferir preço e atender quando solicitada." : "Adicionar foto própria quando a unidade for conferida."}</p></li></ol></section></TabsContent></TabsContents>
      </Tabs>}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">{modo !== "detalhe" ? <button type="button" onClick={() => setModo("detalhe")} className="h-10 cursor-pointer rounded-control px-3 text-sm font-medium text-text-muted transition hover:bg-surface-raised hover:text-text-primary">Cancelar</button> : podeArquivar && podeEditar && unidade.estado !== "reservada" ? <button type="button" onClick={onArquivar} className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-control px-3 text-sm font-medium text-danger transition hover:bg-danger-bg"><Archive size={16} />Arquivar</button> : <span className="text-xs text-text-muted">{unidade.individualizada === false ? "Sem ficha individual" : unidade.estado === "reservada" ? "Libere a reserva para arquivar" : "Consulta"}</span>}{modo === "reservar" ? <button type="button" disabled={!reservaPronta} onClick={confirmarReserva} className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-control bg-accent px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"><BookmarkCheck size={16} />{enviandoReserva ? "Reservando…" : "Confirmar reserva"}</button> : modo === "editar" ? <button type="button" disabled={operacional && (!Number.isFinite(Number(preco)) || Number(preco) <= 0)} onClick={salvar} className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-control bg-accent px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 size={16} />Salvar alterações</button> : <div className="flex flex-wrap items-center gap-2">{mostrarReservar && <button type="button" onClick={() => setModo("reservar")} className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-control border border-border-default bg-surface-card px-3 text-sm font-medium text-text-secondary transition hover:border-accent/40 hover:text-accent"><BookmarkCheck size={16} />Reservar</button>}{podeEditar && <button type="button" onClick={() => setModo("editar")} className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-control bg-accent px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-hover"><Pencil size={16} />Editar unidade</button>}</div>}</footer>
    </div>
  </InventoryDrawer>;
}
