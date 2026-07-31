import type { ModeloMoto, FormaPagamento } from '../../types/catalog';

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
  observacoes: string | null;
  data: string;
  criado_em: string;
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
  observacoes?: string | null;
  data?: string;
}
