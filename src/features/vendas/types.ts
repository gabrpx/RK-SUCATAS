import type { ModeloMoto, FormaPagamento } from '../../types/catalog';
import type { ClienteResumo } from '../clientes/types';

export interface Venda {
  id: string;
  estoque_id: string | null;
  nome_item: string; // snapshot do nome do item no momento da venda
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  forma_pagamento_id: string | null;
  forma_pagamento?: FormaPagamento | null;
  modelo_moto_id: string | null;
  modelo_moto?: ModeloMoto | null;
  cliente_nome: string | null;
  cliente_id: string | null;
  cliente?: ClienteResumo | null;
  observacoes: string | null;
  // Nome da parte vendida avulsa (ex: "Inferior"), quando a venda não é do
  // item inteiro — ver estoque.componentes / estoque.unidades_incompletas.
  componente_vendido: string | null;
  data: string;
  criado_em: string;
  // Canal de origem — 'mercado_livre' quando a venda veio de um pedido
  // importado (ver src/services/mercadolivreSync.ts); os 3 campos ml_* só
  // existem nesse caso.
  canal: 'balcao' | 'mercado_livre';
  ml_order_id: string | null;
  ml_item_id: string | null;
  ml_shipping_id: string | null;
}

// Payload pra registrar uma venda nova (chama a função registrar_venda no banco,
// que baixa o estoque e lança a entrada no caixa de forma atômica).
export interface VendaInput {
  estoque_id: string;
  quantidade: number;
  valor_unitario: number;
  forma_pagamento_id: string;
  modelo_moto_id?: string | null;
  cliente_nome?: string | null;
  cliente_id?: string | null;
  observacoes?: string | null;
  data?: string;
  // Quando informado, vende só essa parte do item (não desconta a unidade
  // inteira) — precisa estar em estoque.componentes do item selecionado.
  componente?: string | null;
}
