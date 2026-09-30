import type { Venda } from "../vendas/types";
import type { CaixaEntry, CaixaPendencia, CaixaPendenciaRecebimento } from "../caixa/types";
import type { FiadoRecebimento } from "../fiado/types";
import type { MovimentoDemo, PendenciaDemo, VendaDemo } from "./data";

const dinheiro = (value: number) => Number(value) || 0;

function pagamentosFiado(vendaId: string, recebimentos: FiadoRecebimento[]) {
  return recebimentos
    .filter((recebimento) => recebimento.venda_id === vendaId)
    .map((recebimento) => ({
      meio: recebimento.forma_pagamento?.nome ?? "Forma não informada",
      valor: dinheiro(recebimento.valor),
      ocorridoEm: recebimento.recebido_em,
    }));
}

export function mapearVendas(vendas: Venda[], caixa: CaixaEntry[], fiado: FiadoRecebimento[], podeVerCaixa: boolean): VendaDemo[] {
  return vendas.map((venda) => {
    const pagamentosCaixa = caixa.filter((entrada) => entrada.venda_id === venda.id && entrada.tipo === "entrada");
    const pagamentos = venda.forma_pagamento?.natureza === "fiado"
      ? podeVerCaixa ? pagamentosFiado(venda.id, fiado) : []
      : pagamentosCaixa.length
        ? pagamentosCaixa.map((entrada) => ({ meio: entrada.forma_pagamento?.nome ?? "Forma não informada", valor: dinheiro(entrada.valor), ocorridoEm: entrada.data }))
        : venda.forma_pagamento?.nome ? [{ meio: venda.forma_pagamento.nome, valor: dinheiro(venda.valor_total), ocorridoEm: venda.data }] : [];
    const recebido = venda.forma_pagamento?.natureza === "fiado"
      ? podeVerCaixa ? pagamentos.reduce((total, pagamento) => total + pagamento.valor, 0) : null
      : podeVerCaixa ? pagamentosCaixa.reduce((total, entrada) => total + dinheiro(entrada.valor), 0) : dinheiro(venda.valor_total);

    return {
      id: venda.id,
      cliente: venda.cliente?.nome || venda.cliente_nome || "Balcão",
      item: venda.nome_item,
      unidade: venda.unidade?.sku ? `SKU ${venda.unidade.sku}` : venda.unidade?.nome || "Não especificada",
      ocorridoEm: venda.data,
      valor: dinheiro(venda.valor_total),
      recebido,
      pagamentos,
      canal: venda.canal === "mercado_livre" ? "Mercado Livre" : "Balcão",
      grau: "—",
      temComprovantePix: false,
    };
  });
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
      };
    });

  const pendenciasManuais: PendenciaDemo[] = pendenciasCaixa
    .filter((pendencia) => pendencia.status === "aberta")
    .map((pendencia) => {
      const pagamentos = recebimentosPendencia
        .filter((recebimento) => recebimento.pendencia_id === pendencia.id)
        .map((recebimento) => ({
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
      };
    });

  return [...pendenciasVenda, ...pendenciasManuais].filter((item) => item.pago < item.total);
}
