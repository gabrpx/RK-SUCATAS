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
  // Id numérico do comprador no ML — hoje só usado pra facilitar vincular
  // manualmente a um cliente cadastrado (ver migration_035). Sem matching
  // automático, mesma regra do resto da integração.
  compradorMlId: number | null;
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
  // Vínculo manual escolhido na tela de importação — nunca preenchido
  // automaticamente a partir do nickname/id do comprador.
  cliente_id?: string | null;
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

// Uma linha da lista de revisão de sincronização — 1 por anúncio vinculado
// (não por peça: item com 2+ anúncios aparece em 2+ linhas, uma por link).
export interface AnuncioParaSincronizar {
  linkId: string;
  estoqueId: string;
  estoqueNome: string;
  mlbId: string;
  url: string;
  disponivelNoMl: boolean;
  fechado: boolean;
  precoAtualMl: number | null;
  quantidadeAtualMl: number | null;
  statusAtualMl: string | null;
  precoEfetivoSistema: number;
  margemAplicada: number;
  precoNovoSistema: number;
  quantidadeNovaSistema: number;
  statusNovoSistema: 'active' | 'paused';
  mudaPreco: boolean;
  mudaQuantidade: boolean;
  mudaStatus: boolean;
  semAlteracao: boolean;
}

export interface PreviewSincronizacao {
  margemPercentual: number;
  anuncios: AnuncioParaSincronizar[];
}

export interface AplicarSincronizacaoResultado {
  processados: number;
  sincronizados: number;
  semAlteracao: number;
  indisponiveis: number;
  erros: { linkId: string; estoqueNome: string; mlbId: string; error: string }[];
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
  // Melhor peça do estoque candidata a ser esse anúncio, por título parecido
  // (fuzzy match) — null quando nenhuma peça bate o suficiente.
  sugestao: { estoqueId: string; nome: string; similaridade: number } | null;
}

export interface ItemAnuncioDuplicado {
  mlbId: string;
  titulo: string;
  preco: number;
  permalink: string;
  thumbnail: string | null;
  quantidadeDisponivel: number;
  status: string;
  vinculado: boolean;
}

export interface GrupoAnuncioDuplicado {
  grupoId: string;
  itens: ItemAnuncioDuplicado[];
  similaridadeMinima: number;
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
