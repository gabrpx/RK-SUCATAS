import { useEffect, useState } from "react";
import { ArrowUpRight, Bike, FileImage, Plus } from "lucide-react";
import { InventoryDrawer } from "../../estoque-preview/InventoryDrawer";
import { Button } from "@/src/components/ui/button";
import { Combobox } from "@/src/components/ui/Combobox";
import { Select } from "@/src/components/ui/Select";
import { CurrencyInput } from "@/src/components/ui/CurrencyInput";
import type { Cliente, ClienteMotoResumo } from "@/src/features/clientes/types";
import { PaymentMethodMark } from "./PaymentMarks";
import type { MeioPagamentoDemo, PendenciaDemo } from "../data";

export type AcaoPreview =
  | { tipo: "venda" }
  | { tipo: "conta" }
  | { tipo: "saida" }
  | { tipo: "pagamento"; pendencia: PendenciaDemo }
  | { tipo: "cobranca"; pendencia: PendenciaDemo };

export type AcaoConfirmada =
  | { tipo: "venda"; cliente: string; item: string; valor: number; pagamentos: Array<{ valor: number; meio: MeioPagamentoDemo }> }
  | { tipo: "conta"; nome: string; descricao: string; valor: number; vencimento: string; recorrencia: "Sem recorrência" | "Semanal" | "Mensal" | "Anual" }
  | { tipo: "saida"; descricao: string; valor: number; meio: MeioPagamentoDemo }
  | { tipo: "pagamento"; pendenciaId: string; valor: number; meio: MeioPagamentoDemo; novoVencimento: string }
  | { tipo: "cobranca-tratada"; pendenciaId: string };

const moedas = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const field = "mt-1.5 h-11 w-full rounded-control border border-border-default bg-surface-inset px-3 text-base text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm";
const label = "block text-xs font-semibold text-text-secondary";
const meios: MeioPagamentoDemo[] = ["Pix", "Dinheiro", "Cartão de débito", "Cartão de crédito"];

function CampoMoeda({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <CurrencyInput label={label} size="lg" value={Math.round(Math.max(0, value) * 100)} onChange={(centavos) => onChange(centavos / 100)} className="tabular-nums" />;
}

export function ActionDrawer({ action, onClose, onConfirm, clientes, motosClientes, statusClientes }: { action: AcaoPreview | null; onClose: () => void; onConfirm: (action: AcaoConfirmada) => void; clientes: Cliente[]; motosClientes: ClienteMotoResumo[]; statusClientes: "carregando" | "pronto" | "restrito" | "erro" }) {
  const [clienteId, setClienteId] = useState("");
  const [item, setItem] = useState("Farol dianteiro · Honda CG 160 · UN-1842");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState(285);
  const [recebido, setRecebido] = useState(285);
  const [meio, setMeio] = useState<MeioPagamentoDemo>("Pix");
  const [outroMeio, setOutroMeio] = useState<MeioPagamentoDemo>("Dinheiro");
  const [outroValor, setOutroValor] = useState(0);
  const [adicionarOutroMeio, setAdicionarOutroMeio] = useState(false);
  const [vencimento, setVencimento] = useState("");
  const [recorrencia, setRecorrencia] = useState<"Sem recorrência" | "Semanal" | "Mensal" | "Anual">("Sem recorrência");

  useEffect(() => {
    if (!action) return;
    setClienteId("");
    setItem("Farol dianteiro · Honda CG 160 · UN-1842");
    setNome(action.tipo === "conta" ? "Fornecedor ou prestador" : "");
    setDescricao(action.tipo === "saida" ? "Lançamento manual" : "");
    setValor(action.tipo === "pagamento" ? action.pendencia.total - action.pendencia.pago : 285);
    setRecebido(action.tipo === "pagamento" ? action.pendencia.total - action.pendencia.pago : 285);
    setMeio("Pix");
    setOutroMeio("Dinheiro");
    setOutroValor(0);
    setAdicionarOutroMeio(false);
    setVencimento("");
    setRecorrencia("Sem recorrência");
  }, [action]);

  const title = action?.tipo === "venda" ? "Nova venda demonstrativa"
    : action?.tipo === "pagamento" ? "Registrar recebimento"
      : action?.tipo === "conta" ? "Adicionar conta a pagar"
        : action?.tipo === "saida" ? "Registrar saída"
          : action?.tipo === "cobranca" ? "Revisar cobrança manual" : "Ação demonstrativa";

  function submit() {
    if (!action) return;
    if (action.tipo === "venda") {
      const cliente = clientes.find((entry) => entry.id === clienteId)?.nome ?? "Balcão";
      const total = Math.max(0, valor);
      const primeiro = Math.min(Math.max(0, recebido), total);
      const segundo = adicionarOutroMeio ? Math.min(Math.max(0, outroValor), total - primeiro) : 0;
      const pagamentos = [
        ...(primeiro > 0 ? [{ valor: primeiro, meio }] : []),
        ...(segundo > 0 ? [{ valor: segundo, meio: outroMeio }] : []),
      ];
      onConfirm({ tipo: "venda", cliente, item, valor: total, pagamentos });
    }
    if (action.tipo === "conta") onConfirm({ tipo: "conta", nome: nome.trim() || "Fornecedor de demonstração", descricao: descricao.trim() || "Conta da empresa", valor: Math.max(0, valor), vencimento, recorrencia });
    if (action.tipo === "saida") onConfirm({ tipo: "saida", descricao: descricao.trim() || "Lançamento manual", valor: Math.max(0, valor), meio });
    if (action.tipo === "pagamento") onConfirm({ tipo: "pagamento", pendenciaId: action.pendencia.id, valor: Math.min(Math.max(0, valor), action.pendencia.total - action.pendencia.pago), meio, novoVencimento: vencimento });
    if (action.tipo === "cobranca") onConfirm({ tipo: "cobranca-tratada", pendenciaId: action.pendencia.id });
  }

  return <InventoryDrawer
    isOpen={Boolean(action)}
    onClose={onClose}
    title={title}
  >
    <div className="mb-4 rounded-control border border-border-default bg-surface-inset px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">Interação local · nada será gravado</p>
      {action?.tipo === "cobranca" && <p className="mt-1 text-xs leading-5 text-text-secondary">Confira o texto antes de qualquer contato. Esta preview não abre o WhatsApp nem envia mensagem.</p>}
    </div>
    <div className="space-y-4 pb-1">
    {action?.tipo === "venda" && <div className="space-y-4">
      <Combobox
        label="Cliente (opcional)"
        placeholder={statusClientes === "carregando" ? "Carregando clientes…" : statusClientes === "erro" ? "Clientes indisponíveis" : "Selecione um cliente"}
        helper={statusClientes === "pronto" ? clientes.length ? `${clientes.length} clientes ativos · consulta somente leitura` : "Nenhum cliente ativo cadastrado. A venda local ficará como Balcão." : statusClientes === "restrito" ? "A lista requer acesso autorizado a Clientes. A venda demonstrativa pode continuar como Balcão." : statusClientes === "erro" ? "Não foi possível consultar os clientes. Nenhum cadastro foi alterado." : "Consultando clientes cadastrados…"}
        value={clienteId}
        onChange={setClienteId}
        disabled={statusClientes !== "pronto" || clientes.length === 0}
        size="lg"
        options={clientes.map((cliente) => {
          const motos = motosClientes.filter((moto) => moto.cliente_id === cliente.id).map((moto) => `${moto.modelo_moto?.nome ?? "Moto não identificada"}${moto.modelo_moto?.ano ? ` ${moto.modelo_moto.ano}` : ""}`);
          return { value: cliente.id, label: [cliente.nome, ...motos].join(" ") };
        })}
        renderOption={(option) => {
          const cliente = clientes.find((entry) => entry.id === option.value);
          const motos = motosClientes.filter((moto) => moto.cliente_id === option.value).map((moto) => `${moto.modelo_moto?.nome ?? "Moto não identificada"}${moto.modelo_moto?.ano ? ` ${moto.modelo_moto.ano}` : ""}`);
          return <span className="flex min-w-0 items-center justify-between gap-3"><span className="truncate">{cliente?.nome ?? option.label}</span><span className="inline-flex max-w-[55%] shrink-0 items-center gap-1 rounded-full border border-accent/15 bg-accent-soft-bg px-2 py-1 text-[10px] font-medium text-accent"><Bike size={12} className="shrink-0" /><span className="truncate">{motos[0] ?? "Sem moto"}</span>{motos.length > 1 && <span className="font-mono">+{motos.length - 1}</span>}</span></span>;
        }}
        renderValue={(option) => {
          const cliente = clientes.find((entry) => entry.id === option.value);
          const moto = motosClientes.find((entry) => entry.cliente_id === option.value);
          const nomeMoto = moto ? `${moto.modelo_moto?.nome ?? "Moto não identificada"}${moto.modelo_moto?.ano ? ` ${moto.modelo_moto.ano}` : ""}` : "Sem moto";
          const quantidadeMotos = motosClientes.filter((entry) => entry.cliente_id === option.value).length;
          return <span className="flex min-w-0 items-center gap-2"><span className="truncate">{cliente?.nome ?? option.label}</span><span className="inline-flex min-w-0 shrink-0 items-center gap-1 rounded-full border border-accent/15 bg-accent-soft-bg px-2 py-0.5 text-[10px] font-medium text-accent"><Bike size={12} className="shrink-0" /><span className="max-w-32 truncate">{nomeMoto}</span>{quantidadeMotos > 1 && <span className="font-mono">+{quantidadeMotos - 1}</span>}</span></span>;
        }}
      />
      <label className={label}>Peça e unidade do estoque<input value={item} onChange={(event) => setItem(event.target.value)} className={field} /><span className="mt-1 block text-[11px] font-normal text-text-muted">A venda real exige selecionar a unidade física.</span></label>
      <CampoMoeda label="Total da venda" value={valor} onChange={setValor} />
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(8rem,.7fr)] gap-2"><Select label="1ª forma" value={meio} onChange={(value) => setMeio(value as MeioPagamentoDemo)} options={meios.map((value) => ({ value, label: value }))} size="lg" renderOption={(option) => <span className="inline-flex items-center gap-2"><PaymentMethodMark meio={option.value as MeioPagamentoDemo} className="size-4" />{option.label}</span>} renderValue={(option) => <span className="inline-flex items-center gap-2"><PaymentMethodMark meio={option.value as MeioPagamentoDemo} className="size-4" />{option.label}</span>} /><CampoMoeda label="Valor recebido" value={recebido} onChange={setRecebido} /></div>
      {adicionarOutroMeio && <div className="grid grid-cols-[minmax(0,1fr)_minmax(8rem,.7fr)] gap-2"><Select label="2ª forma" value={outroMeio} onChange={(value) => setOutroMeio(value as MeioPagamentoDemo)} options={meios.map((value) => ({ value, label: value }))} size="lg" renderOption={(option) => <span className="inline-flex items-center gap-2"><PaymentMethodMark meio={option.value as MeioPagamentoDemo} className="size-4" />{option.label}</span>} renderValue={(option) => <span className="inline-flex items-center gap-2"><PaymentMethodMark meio={option.value as MeioPagamentoDemo} className="size-4" />{option.label}</span>} /><CampoMoeda label="Valor" value={outroValor} onChange={setOutroValor} /></div>}
      {!adicionarOutroMeio && <button type="button" onClick={() => setAdicionarOutroMeio(true)} className="inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold text-accent hover:underline"><Plus size={14} />Adicionar outra forma de pagamento</button>}
      <div className="flex items-center justify-between rounded-control bg-surface-inset p-3"><div><p className="text-xs text-text-muted">Total · recebido · saldo</p><p className="mt-1 text-sm font-semibold">{moedas(valor)} · {moedas(Math.min(valor, recebido + (adicionarOutroMeio ? outroValor : 0)))} · {moedas(Math.max(0, valor - recebido - (adicionarOutroMeio ? outroValor : 0)))}</p></div><span className="inline-flex items-center gap-1.5 text-[10px] text-text-muted"><FileImage size={15} />Comprovante Pix no detalhe</span></div>
    </div>}
    {action?.tipo === "pagamento" && <div className="space-y-4">
      <div className="rounded-control border border-border-default bg-surface-inset p-3"><p className="text-sm font-semibold">{action.pendencia.nome}</p><p className="mt-1 text-xs text-text-muted">Saldo atual de {moedas(action.pendencia.total - action.pendencia.pago)}</p></div>
      <CampoMoeda label="Valor recebido" value={valor} onChange={(next) => setValor(Math.min(next, action.pendencia.total - action.pendencia.pago))} />
      <Select label="Forma de pagamento" value={meio} onChange={(value) => setMeio(value as MeioPagamentoDemo)} options={meios.map((value) => ({ value, label: value }))} size="lg" renderOption={(option) => <span className="inline-flex items-center gap-2"><PaymentMethodMark meio={option.value as MeioPagamentoDemo} className="size-4" />{option.label}</span>} renderValue={(option) => <span className="inline-flex items-center gap-2"><PaymentMethodMark meio={option.value as MeioPagamentoDemo} className="size-4" />{option.label}</span>} />
      <label className={label}>Novo vencimento do saldo<input type="date" value={vencimento} onChange={(event) => setVencimento(event.target.value)} className={field} /><span className="mt-1 block text-[11px] font-normal text-text-muted">Após um pagamento parcial, a equipe define o novo prazo.</span></label>
    </div>}
    {(action?.tipo === "conta" || action?.tipo === "saida") && <div className="space-y-4">
      {action.tipo === "conta" && <label className={label}>Fornecedor<input value={nome} onChange={(event) => setNome(event.target.value)} className={field} /></label>}
      <label className={label}>Descrição<input value={descricao} onChange={(event) => setDescricao(event.target.value)} className={field} /></label>
      <div className="grid grid-cols-2 gap-3"><CampoMoeda label="Valor" value={valor} onChange={setValor} />{action.tipo === "conta" ? <label className={label}>Vencimento<input type="date" value={vencimento} onChange={(event) => setVencimento(event.target.value)} className={field} /></label> : <Select label="Pagamento" value={meio} onChange={(value) => setMeio(value as MeioPagamentoDemo)} options={meios.map((value) => ({ value, label: value }))} size="lg" renderOption={(option) => <span className="inline-flex items-center gap-2"><PaymentMethodMark meio={option.value as MeioPagamentoDemo} className="size-4" />{option.label}</span>} renderValue={(option) => <span className="inline-flex items-center gap-2"><PaymentMethodMark meio={option.value as MeioPagamentoDemo} className="size-4" />{option.label}</span>} />}</div>
      {action.tipo === "conta" && <fieldset><legend className={label}>Recorrência</legend><div className="mt-2 flex flex-wrap gap-2">{(["Sem recorrência", "Semanal", "Mensal", "Anual"] as const).map((opcao) => <button key={opcao} type="button" aria-pressed={recorrencia === opcao} onClick={() => setRecorrencia(opcao)} className={`min-h-10 rounded-full border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 ${recorrencia === opcao ? "border-accent/25 bg-accent-soft-bg text-accent" : "border-border-default bg-surface-card text-text-muted hover:text-text-primary"}`}>{opcao}</button>)}</div></fieldset>}
    </div>}
    {action?.tipo === "cobranca" && <div className="space-y-3"><div className="rounded-control border border-warning/25 bg-warning-bg p-3 text-sm"><p className="font-semibold">{action.pendencia.nome} · saldo {moedas(action.pendencia.total - action.pendencia.pago)}</p><p className="mt-1 text-xs leading-5 text-text-secondary">Texto sugerido para revisão: “Olá, {action.pendencia.nome.split(" ")[0]}. Estou entrando em contato para confirmar o pagamento pendente. Quando puder, me avise por aqui.”</p></div><p className="text-xs leading-5 text-text-muted">Marcar como tratada encerra o destaque interno, mas a pendência continua na fila.</p></div>}
    </div>
    <div className="sticky bottom-0 z-10 -mx-4 -mb-4 mt-5 flex flex-wrap justify-end gap-2 border-t border-border-default bg-surface-card/95 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 backdrop-blur sm:-mx-5 sm:-mb-5 sm:px-5">
      <Button type="button" variant="ghost" size="mobile" onClick={onClose}>Fechar</Button>
      <Button type="button" variant="default" size="mobile" className="bg-accent text-white shadow-sm hover:bg-accent-hover" onClick={submit}>{action?.tipo === "cobranca" ? <><ArrowUpRight size={15} />Marcar como tratada</> : action?.tipo === "venda" ? "Adicionar à demonstração" : action?.tipo === "pagamento" ? "Registrar recebimento" : "Adicionar à demonstração"}</Button>
    </div>
  </InventoryDrawer>;
}
