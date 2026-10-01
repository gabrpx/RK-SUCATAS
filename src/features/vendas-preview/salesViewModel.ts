import type { CaixaEntry } from '../caixa/types';
import type { FiadoRecebimento } from '../fiado/types';
import type { Venda } from '../vendas/types';
import type { VendaDemo } from './data';

export type SaleReconciliation =
  | { kind: 'unavailable' }
  | { kind: 'settled'; received: number }
  | { kind: 'open'; received: number; outstanding: number }
  | { kind: 'needs-review'; recordedMethod: string | null };

export interface SaleViewModel extends VendaDemo {
  reconciliation: SaleReconciliation;
  unidadeDetalhes: Venda['unidade'];
  moto: Venda['modelo_moto'];
  observacoes: string | null;
  mlOrderId: string | null;
}

const amount = (value: number) => Number(value) || 0;

function reconcile(received: number, total: number): SaleReconciliation {
  const normalizedReceived = Math.max(0, received);
  const outstanding = Math.max(0, total - normalizedReceived);
  return outstanding <= 0.005
    ? { kind: 'settled', received: normalizedReceived }
    : { kind: 'open', received: normalizedReceived, outstanding };
}

export function buildSaleViewModels(
  vendas: Venda[],
  caixa: CaixaEntry[],
  recebimentosFiado: FiadoRecebimento[],
  options: { canViewCash: boolean },
): SaleViewModel[] {
  const caixaPorVenda = new Map<string, CaixaEntry[]>();
  const fiadoPorVenda = new Map<string, FiadoRecebimento[]>();
  for (const entry of caixa) {
    if (entry.venda_id && entry.tipo === 'entrada') {
      const entries = caixaPorVenda.get(entry.venda_id) ?? [];
      entries.push(entry);
      caixaPorVenda.set(entry.venda_id, entries);
    }
  }
  for (const receipt of recebimentosFiado) {
    const entries = fiadoPorVenda.get(receipt.venda_id) ?? [];
    entries.push(receipt);
    fiadoPorVenda.set(receipt.venda_id, entries);
  }
  return vendas.map((venda) => {
    const total = amount(venda.valor_total);
    const isCredit = venda.forma_pagamento?.natureza === 'fiado';
    const isMarketplace = venda.canal === 'mercado_livre';
    const cashEntries = caixaPorVenda.get(venda.id) ?? [];
    const creditReceipts = fiadoPorVenda.get(venda.id) ?? [];
    const payments = options.canViewCash
      ? (isCredit ? creditReceipts.map((receipt) => ({
          meio: receipt.forma_pagamento?.nome ?? 'Forma não informada',
          valor: amount(receipt.valor),
          ocorridoEm: receipt.recebido_em,
        })) : cashEntries.map((entry) => ({
          meio: entry.forma_pagamento?.nome ?? 'Forma não informada',
          valor: amount(entry.valor),
          ocorridoEm: entry.data,
        })))
      : [];

    let reconciliation: SaleReconciliation;
    if (!options.canViewCash) {
      reconciliation = { kind: 'unavailable' };
    } else if (!isCredit && cashEntries.length === 0) {
      reconciliation = { kind: 'needs-review', recordedMethod: venda.forma_pagamento?.nome ?? null };
    } else if (isMarketplace && !isCredit) {
      // O Caixa registra o líquido após taxa/frete; a diferença para o bruto
      // da venda não é saldo devido pelo comprador.
      reconciliation = { kind: 'settled', received: payments.reduce((sum, payment) => sum + payment.valor, 0) };
    } else {
      reconciliation = reconcile(payments.reduce((sum, payment) => sum + payment.valor, 0), total);
    }

    const recebido = reconciliation.kind === 'settled' || reconciliation.kind === 'open'
      ? reconciliation.received
      : reconciliation.kind === 'needs-review' ? 0 : null;
    const condition = venda.unidade?.condicao_nota;
    const grau = condition == null ? '—' : condition >= 8 ? 'A' : condition >= 5 ? 'B' : 'C';

    return {
      id: venda.id,
      cliente: venda.cliente?.nome || venda.cliente_nome || 'Balcão',
      item: venda.nome_item,
      unidade: venda.unidade?.sku ? `SKU ${venda.unidade.sku}` : venda.unidade?.nome || 'Não especificada',
      ocorridoEm: venda.data,
      valor: total,
      recebido,
      pagamentos: payments,
      canal: venda.canal === 'mercado_livre' ? 'Mercado Livre' : 'Balcão',
      grau,
      temComprovantePix: false,
      reconciliation,
      unidadeDetalhes: venda.unidade,
      moto: venda.modelo_moto,
      observacoes: venda.observacoes,
      mlOrderId: venda.ml_order_id,
    };
  });
}
