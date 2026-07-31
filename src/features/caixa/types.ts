import type { FormaPagamento } from '../../types/catalog';

export type CaixaTipo = 'entrada' | 'saida';

export interface CaixaEntry {
  id: string;
  tipo: CaixaTipo;
  descricao: string;
  valor: number;
  forma_pagamento_id: string | null;
  forma_pagamento?: FormaPagamento | null;
  venda_id: string | null; // preenchido automaticamente quando a entrada veio de uma venda
  data: string;
  criado_em: string;
}

// Payload de lançamento manual (despesas/retiradas não ligadas a uma venda).
export type CaixaEntryInput = Pick<CaixaEntry, 'tipo' | 'descricao' | 'valor' | 'forma_pagamento_id' | 'data'>;
