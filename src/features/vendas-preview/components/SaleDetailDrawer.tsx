import { ArrowDownLeft, Hash, Package, ShoppingBag, Store, UserRound } from "lucide-react";
import { InventoryDrawer } from "../../estoque-preview/InventoryDrawer";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { parseDataLocal } from "../data";
import type { SaleViewModel } from "../salesViewModel";
import { MercadoLivreBadge, PaymentMethodMark } from "./PaymentMarks";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const eyebrow = "font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint";
const card = "rounded-control border border-border-default bg-surface-card p-4";

function dataHora(value: string) {
  const date = parseDataLocal(value);
  return date.toLocaleString("pt-BR", /^\d{4}-\d{2}-\d{2}$/.test(value) ? { day: "2-digit", month: "long", year: "numeric" } : { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function dataRelativa(value: string) {
  const date = parseDataLocal(value);
  const hoje = new Date();
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  const inicioData = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dias = Math.round((inicioHoje - inicioData) / 86400000);
  return dias === 0 ? "Hoje" : dias === 1 ? "Ontem" : `Há ${dias} dias`;
}

export function SaleDetailDrawer({ sale, onClose }: { sale: SaleViewModel | null; onClose: () => void }) {
  const saldo = sale?.reconciliation.kind === "open" ? sale.reconciliation.outstanding : null;
  const pago = sale?.reconciliation.kind === "settled";
  const precisaConciliar = sale?.reconciliation.kind === "needs-review";
  const indisponivel = sale?.reconciliation.kind === "unavailable";
  const metodoParaConciliar = sale?.reconciliation.kind === "needs-review" ? sale.reconciliation.recordedMethod : null;
  const foto = sale?.unidadeDetalhes?.fotos?.[0] ?? null;

  return <InventoryDrawer isOpen={Boolean(sale)} onClose={onClose} title={sale ? `Detalhes da venda ${sale.id}` : "Detalhes da venda"}>
    {sale && <div className="space-y-4">
      <header className="border-b border-border-subtle pb-4">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-soft-fg">Registro de venda · {dataRelativa(sale.ocorridoEm)}</p>
        <h2 className="mt-1 break-words text-xl font-semibold tracking-tight text-text-primary">{sale.cliente}</h2>
        <p className="mt-1 text-sm text-text-muted">{dataHora(sale.ocorridoEm)}</p>
        <div className="mt-3"><StatusBadge texto={indisponivel ? "Informação financeira restrita" : precisaConciliar ? "Conciliação necessária" : pago ? "Pago" : "Saldo em aberto"} tom={indisponivel ? "neutral" : pago ? "positive" : "warning"} /></div>
      </header>

      <section aria-label="Resumo financeiro da venda" className={`rounded-card border p-4 ${pago ? "border-positive/20 bg-positive-bg/60" : "border-warning/25 bg-warning-bg/60"} ${sale.canal === "Mercado Livre" ? "meli-sale-highlight border-[#e7ca00]" : ""}`}>
        <p className="flex items-center gap-2 text-xs font-semibold text-text-secondary">{indisponivel || precisaConciliar ? <ShoppingBag size={15} /> : pago ? <ArrowDownLeft size={15} className="text-positive" /> : <ShoppingBag size={15} className="text-warning" />}{indisponivel ? "Situação financeira" : precisaConciliar ? "Registro sem lançamento vinculado" : pago ? "Total recebido" : "Saldo em aberto"}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-text-primary">{indisponivel ? "Sem acesso ao Caixa" : precisaConciliar ? "Revisar no Caixa" : money(pago ? sale.recebido ?? 0 : saldo ?? 0)}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-200/80 pt-3 text-xs">
          <div><p className="text-text-muted">Total da venda</p><p className="mt-0.5 font-semibold tabular-nums text-text-primary">{money(sale.valor)}</p></div>
          <div><p className="text-text-muted">Já recebido</p><p className="mt-0.5 font-semibold tabular-nums text-text-primary">{indisponivel || precisaConciliar ? "—" : money(sale.recebido ?? 0)}</p></div>
        </div>
      </section>

      <section className={card}>
        <p className={eyebrow}>Peça e unidade</p>
        <div className="mt-3 flex items-start gap-3">
          {foto ? <img src={foto} alt={`Unidade de ${sale.item}`} className="size-[4.5rem] shrink-0 rounded-control border border-border-default object-cover" /> : <div className="grid size-[4.5rem] shrink-0 place-items-center rounded-control border border-dashed border-border-default bg-surface-inset text-text-muted" aria-label="Miniatura indisponível"><div className="flex flex-col items-center gap-1"><Package size={21} strokeWidth={1.7} /><span className="text-[9px] font-medium">Sem foto</span></div></div>}
          <div className="min-w-0">
            <h3 className="break-words text-sm font-semibold leading-5 text-text-primary">{sale.item}</h3>
            <p className="mt-2 inline-flex items-center gap-1.5 font-mono text-xs text-text-muted"><Hash size={13} />Unidade {sale.unidade}</p>
            {sale.grau !== "—" && <p className="mt-1 text-xs text-text-muted">Condição · <strong className="font-semibold text-text-secondary">Grau {sale.grau}</strong></p>}
            {sale.unidadeDetalhes?.descricao && <p className="mt-2 text-xs leading-5 text-text-secondary">{sale.unidadeDetalhes.descricao}</p>}
            {sale.unidadeDetalhes?.avaria && <p className="mt-2 rounded-control bg-warning-bg px-2 py-1.5 text-xs text-warning">Avaria: {sale.unidadeDetalhes.avaria_descricao || "sem descrição"}</p>}
          </div>
        </div>
      </section>

      <section className={card}>
        <div className="flex items-center justify-between gap-3"><p className={eyebrow}>Canal da venda</p><Store size={15} className="text-text-muted" /></div>
        <div className="mt-2"><MercadoLivreBadge canal={sale.canal} /></div>
        {sale.mlOrderId && <p className="mt-2 font-mono text-[10px] text-text-faint">Pedido ML {sale.mlOrderId}</p>}
      </section>

      {(sale.moto || sale.observacoes) && <section className={card}>
        <p className={eyebrow}>Contexto da venda</p>
        {sale.moto && <p className="mt-2 text-sm text-text-secondary">Moto: <strong className="font-semibold text-text-primary">{sale.moto.nome}{sale.moto.ano ? ` · ${sale.moto.ano}` : ""}</strong></p>}
        {sale.observacoes && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{sale.observacoes}</p>}
      </section>}

      <section className={card}>
        <div className="flex items-center justify-between gap-3"><div><p className={eyebrow}>Pagamentos recebidos</p><p className="mt-1 text-xs text-text-muted">Cada lançamento inclui forma, valor e data.</p></div></div>
        {indisponivel ? <p className="mt-3 rounded-control bg-surface-inset p-3 text-sm text-text-muted">Os detalhes de recebimento exigem acesso ao Caixa.</p> : precisaConciliar ? <p className="mt-3 rounded-control bg-info-bg p-3 text-sm text-info">A venda informa {metodoParaConciliar ?? "uma forma de pagamento"}, mas não há entrada vinculada no Caixa. Revise a conciliação antes de considerar o valor recebido.</p> : sale.pagamentos.length ? <ul className="mt-3 divide-y divide-border-subtle">
          {sale.pagamentos.map((pagamento, index) => <li key={`${pagamento.meio}-${pagamento.ocorridoEm}-${index}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <span className="grid size-9 shrink-0 place-items-center rounded-control bg-surface-inset text-accent-soft-fg"><PaymentMethodMark meio={pagamento.meio} /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-text-primary">{pagamento.meio}</span><span className="mt-0.5 block text-xs text-text-muted">{dataHora(pagamento.ocorridoEm)}</span></span>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-text-primary">{money(pagamento.valor)}</span>
          </li>)}
        </ul> : <p className="mt-3 rounded-control bg-surface-inset p-3 text-sm text-text-muted">Nenhum pagamento registrado</p>}
      </section>

      <section className="rounded-control border border-border-default bg-surface-inset/70 p-3 text-xs leading-5 text-text-muted">
        <div className="flex items-start gap-2"><UserRound size={14} className="mt-0.5 shrink-0" /><span>Informações consultadas dos registros de vendas em modo somente leitura.</span></div>
      </section>
    </div>}
  </InventoryDrawer>;
}
