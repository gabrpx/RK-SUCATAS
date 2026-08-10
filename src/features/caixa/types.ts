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

// Pendência manual de Caixa — "Fiado/Pendência" como 3ª opção no lançamento
// (ver migration_041). Sempre um valor a RECEBER; não lança em `caixa` até
// um recebimento (parcial ou total) ser confirmado.
export type CaixaPendenciaStatus = 'aberta' | 'quitada';

export interface CaixaPendencia {
  id: string;
  descricao: string;
  valor_total: number;
  status: CaixaPendenciaStatus;
  data: string;
  criado_por: string;
  criador?: { id: string; nome_exibicao: string } | null;
  criado_em: string;
  atualizado_em: string;
}

export type CaixaPendenciaInput = Pick<CaixaPendencia, 'descricao' | 'valor_total' | 'data'>;

export interface CaixaPendenciaRecebimento {
  id: string;
  pendencia_id: string;
  valor: number;
  forma_pagamento_id: string;
  forma_pagamento: { id: string; nome: string } | null;
  caixa_id: string | null;
  recebido_por: string;
  recebido_em: string;
  usuario: { id: string; nome_exibicao: string } | null;
}

export interface CaixaPendenciaRecebimentoInput {
  valor: number;
  forma_pagamento_id: string;
}
