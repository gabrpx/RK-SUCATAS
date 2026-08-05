// Tipos do módulo Mercado Livre — espelham exatamente o formato que
// src/server/routes/mercadolivre.ts devolve (a lógica de origem mora em
// src/services/mercadolivreSync.ts, no backend).

export type StatusItemPedido = 'encontrado' | 'nao_encontrado' | 'ja_importado';

export interface ItemPedidoPreview {
  mlItemId: string;
  titulo: string;
  quantidade: number;
  valorUnitario: number;
  status: StatusItemPedido;
  estoqueIdSugerido: string | null;
  estoqueNomeSugerido: string | null;
}

export interface PedidoPreview {
  mlOrderId: string;
  dataCriacao: string;
  comprador: string | null;
  shippingId: string | null;
  itens: ItemPedidoPreview[];
}

// Payload de importação — um item por linha confirmada pelo usuário na
// tela de preview (pode ser mais de um item por pedido).
export interface ImportarPedidoItemInput {
  estoque_id: string;
  quantidade: number;
  valor_unitario: number;
  forma_pagamento_id: string;
  cliente_nome: string | null;
  data: string | null;
  ml_order_id: string;
  ml_item_id: string;
  ml_shipping_id: string | null;
}

export interface ImportarPedidosResultado {
  sucesso: number;
  pulados: number;
  falhas: { mlOrderId: string; mlItemId: string; error: string }[];
}

export interface ResultadoSincronizacao {
  sincronizado: boolean;
  motivo?: 'sem_link_valido' | 'item_nao_encontrado';
  mudouPreco?: boolean;
  mudouQuantidade?: boolean;
  mudouStatus?: boolean;
}

export interface ResultadoReconciliacao {
  verificados: number;
  sincronizados: number;
  ignorados: number;
  erros: { estoqueId: string; nome: string; error: string }[];
}

export interface PerguntaPreview {
  id: number;
  itemId: string;
  texto: string;
  dataCriacao: string;
  rascunhoResposta: string | null;
}

export interface AnuncioOrfaoML {
  mlbId: string;
  titulo: string;
  preco: number;
  permalink: string;
  thumbnail: string | null;
  quantidadeDisponivel: number;
}

export interface EnvioML {
  id: number;
  status: string;
  substatus: string | null;
  trackingNumber: string | null;
  cost: number | null;
}

export interface ContagemPendencias {
  perguntasSemResposta: number;
  pedidosNovos: number;
}
