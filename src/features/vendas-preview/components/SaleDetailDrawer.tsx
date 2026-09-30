import { ArrowDownLeft, Hash, Package, ShoppingBag, Store, UserRound } from "lucide-react";
import { InventoryDrawer } from "../../estoque-preview/InventoryDrawer";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { parseDataLocal, type VendaDemo } from "../data";
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

export function SaleDetailDrawer({ sale, onClose }: { sale: VendaDemo | null; onClose: () => void }) {
  const saldo = sale && sale.recebido !== null ? Math.max(0, sale.valor - sale.recebido) : null;
  const pago = Boolean(sale && saldo === 0);

  return <InventoryDrawer isOpen={Boolean(sale)} onClose={onClose} title={sale ? `Detalhes da venda ${sale.id}` : "Detalhes da venda"}>
    {sale && <div className="space-y-4">
      <header className="border-b border-border-subtle pb-4">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-soft-fg">Registro de venda · {dataRelativa(sale.ocorridoEm)}</p>
        <h2 className="mt-1 break-words text-xl font-semibold tracking-tight text-text-primary">{sale.cliente}</h2>
        <p className="mt-1 text-sm text-text-muted">{dataHora(sale.ocorridoEm)}</p>
        <div className="mt-3"><StatusBadge texto={saldo === null ? "Informação financeira restrita" : pago ? "Pago" : "Saldo em aberto"} tom={saldo === null ? "neutral" : pago ? "positive" : "warning"} /></div>
      </header>

      <section aria-label="Resumo financeiro da venda" className={`rounded-card border p-4 ${pago ? "border-positive/20 bg-positive-bg/60" : "border-warning/25 bg-warning-bg/60"} ${sale.canal === "Mercado Livre" ? "meli-sale-highlight border-[#e7ca00]" : ""}`}>
        <p className="flex items-center gap-2 text-xs font-semibold text-text-secondary">{saldo === null ? <ShoppingBag size={15} /> : pago ? <ArrowDownLeft size={15} className="text-positive" /> : <ShoppingBag size={15} className="text-warning" />}{saldo === null ? "Situação financeira" : pago ? "Total recebido" : "Saldo em aberto"}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-text-primary">{saldo === null ? "Sem acesso ao Caixa" : money(pago ? sale.recebido ?? 0 : saldo)}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-200/80 pt-3 text-xs">
          <div><p className="text-text-muted">Total da venda</p><p className="mt-0.5 font-semibold tabular-nums text-text-primary">{money(sale.valor)}</p></div>
          <div><p className="text-text-muted">Já recebido</p><p className="mt-0.5 font-semibold tabular-nums text-text-primary">{sale.recebido === null ? "—" : money(sale.recebido)}</p></div>
        </div>
      </section>

      <section className={card}>
        <p className={eyebrow}>Peça e unidade</p>
        <div className="mt-3 flex items-start gap-3">
          <div className="grid size-[4.5rem] shrink-0 place-items-center rounded-control border border-dashed border-border-default bg-surface-inset text-text-muted" aria-label="Miniatura indisponível nesta demonstração">
            <div className="flex flex-col items-center gap-1"><Package size={21} strokeWidth={1.7} /><span className="text-[9px] font-medium">Sem foto</span></div>
          </div>
          <div className="min-w-0">
            <h3 className="break-words text-sm font-semibold leading-5 text-text-primary">{sale.item}</h3>
            <p className="mt-2 inline-flex items-center gap-1.5 font-mono text-xs text-text-muted"><Hash size={13} />Unidade {sale.unidade}</p>
            {sale.grau !== "—" && <p className="mt-1 text-xs text-text-muted">Condição · <strong className="font-semibold text-text-secondary">Grau {sale.grau}</strong></p>}
          </div>
        </div>
      </section>

      <section className={card}>
        <div className="flex items-center justify-between gap-3"><p className={eyebrow}>Canal da venda</p><Store size={15} className="text-text-muted" /></div>
        <div className="mt-2"><MercadoLivreBadge canal={sale.canal} /></div>
      </section>

      <section className={card}>
        <div className="flex items-center justify-between gap-3"><div><p className={eyebrow}>Pagamentos recebidos</p><p className="mt-1 text-xs text-text-muted">Cada lançamento inclui forma, valor e data.</p></div></div>
        {sale.recebido === null ? <p className="mt-3 rounded-control bg-surface-inset p-3 text-sm text-text-muted">Os detalhes de recebimento exigem acesso ao Caixa.</p> : sale.pagamentos.length ? <ul className="mt-3 divide-y divide-border-subtle">
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
