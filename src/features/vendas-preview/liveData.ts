import type { Venda } from "../vendas/types";
import type { CaixaEntry, CaixaPendencia, CaixaPendenciaRecebimento } from "../caixa/types";
import type { FiadoRecebimento } from "../fiado/types";
import type { MovimentoDemo, PendenciaDemo } from "./data";
import { buildSaleViewModels, type SaleViewModel } from "./salesViewModel";

const dinheiro = (value: number) => Number(value) || 0;

function pagamentosFiado(vendaId: string, recebimentos: FiadoRecebimento[]) {
  return recebimentos
    .filter((recebimento) => recebimento.venda_id === vendaId)
    .map((recebimento) => ({
      id: recebimento.id,
      meio: recebimento.forma_pagamento?.nome ?? "Forma não informada",
      valor: dinheiro(recebimento.valor),
      ocorridoEm: recebimento.recebido_em,
    }));
}

export function mapearVendas(vendas: Venda[], caixa: CaixaEntry[], fiado: FiadoRecebimento[], podeVerCaixa: boolean): SaleViewModel[] {
  return buildSaleViewModels(vendas, caixa, fiado, { canViewCash: podeVerCaixa });
}

export function mapearMovimentos(caixa: CaixaEntry[], recebimentosFiado: FiadoRecebimento[], recebimentosPendencia: CaixaPendenciaRecebimento[]): MovimentoDemo[] {
  const recebimentosCaixa = new Map<string, string>();
  for (const recebimento of recebimentosFiado) {
    if (recebimento.caixa_id) recebimentosCaixa.set(recebimento.caixa_id, `Recebimento da venda ${recebimento.venda_id}`);
  }
  for (const recebimento of recebimentosPendencia) {
    if (recebimento.caixa_id) recebimentosCaixa.set(recebimento.caixa_id, `Recebimento da pendência ${recebimento.pendencia_id}`);
  }

  return caixa.map((entrada) => {
    const detalheRecebimento = recebimentosCaixa.get(entrada.id);
    return {
      id: entrada.id,
      titulo: entrada.descricao,
      detalhe: entrada.venda_id ? `Venda ${entrada.venda_id}` : detalheRecebimento ?? "Lançamento registrado no Caixa",
      ocorridoEm: entrada.data,
      tipo: entrada.tipo === "entrada" ? "entrada" : "saída",
      valor: dinheiro(entrada.valor),
      metodo: entrada.forma_pagamento?.nome ?? "Forma não informada",
      origem: entrada.venda_id ? "Venda" : detalheRecebimento ? "Recebimento" : "Lançamento manual",
      podeExcluir: !entrada.venda_id && !detalheRecebimento,
    };
  });
}

export function mapearPendencias(
  vendas: Venda[],
  recebimentosFiado: FiadoRecebimento[],
  pendenciasCaixa: CaixaPendencia[],
  recebimentosPendencia: CaixaPendenciaRecebimento[],
): PendenciaDemo[] {
  const pendenciasVenda: PendenciaDemo[] = vendas
    .filter((venda) => venda.forma_pagamento?.natureza === "fiado")
    .map((venda) => {
      const pagamentos = pagamentosFiado(venda.id, recebimentosFiado);
      return {
        id: `venda-${venda.id}`,
        tipo: "A receber",
        nome: venda.cliente?.nome || venda.cliente_nome || "Cliente sem identificação",
        origem: `${venda.nome_item} · ${venda.id}`,
        total: dinheiro(venda.valor_total),
        pago: pagamentos.reduce((total, pagamento) => total + pagamento.valor, 0),
        pagamentos,
        venceEm: null,
        criadaEm: venda.data,
        source: { kind: "fiado", vendaId: venda.id },
        clienteId: venda.cliente_id,
        observacoes: venda.observacoes,
      };
    });

  const pendenciasManuais: PendenciaDemo[] = pendenciasCaixa
    .filter((pendencia) => pendencia.status === "aberta")
    .map((pendencia) => {
      const pagamentos = recebimentosPendencia
        .filter((recebimento) => recebimento.pendencia_id === pendencia.id)
        .map((recebimento) => ({
          id: recebimento.id,
          meio: recebimento.forma_pagamento?.nome ?? "Forma não informada",
          valor: dinheiro(recebimento.valor),
          ocorridoEm: recebimento.recebido_em,
        }));
      return {
        id: `pendencia-${pendencia.id}`,
        tipo: "A receber",
        nome: pendencia.cliente?.nome || "Cliente não vinculado",
        origem: pendencia.descricao,
        total: dinheiro(pendencia.valor_total),
        pago: pagamentos.reduce((total, pagamento) => total + pagamento.valor, 0),
        pagamentos,
        venceEm: null,
        criadaEm: pendencia.data,
        source: { kind: "caixa", pendenciaId: pendencia.id },
        clienteId: pendencia.cliente_id,
        observacoes: null,
      };
    });

  return [...pendenciasVenda, ...pendenciasManuais].filter((item) => item.pago < item.total);
}
