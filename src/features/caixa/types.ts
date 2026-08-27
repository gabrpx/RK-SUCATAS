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

export interface Cobranca {
  id: string;
  venda_id: string | null;
  pendencia_id: string | null;
  boleto_storage_path: string | null;
  boleto_nome_arquivo: string | null;
  boleto_tipo_mime: string | null;
  boleto_tamanho_bytes: number | null;
  intervalo_minutos: number | null;
  horario_fixo: string | null;
  proxima_notificacao_em: string | null;
  timer_ativo: boolean;
  ultimo_envio_em: string | null;
  enviado_por: string | null;
  criador?: { id: string; nome_exibicao: string } | null;
  enviador?: { id: string; nome_exibicao: string } | null;
  criado_por: string | null;
  criado_em: string;
}

export interface CobrancaInput {
  venda_id?: string | null;
  pendencia_id?: string | null;
  intervalo_minutos?: number | null;
  horario_fixo?: string | null;
  boleto_storage_path?: string | null;
  boleto_nome_arquivo?: string | null;
  boleto_tipo_mime?: string | null;
  boleto_tamanho_bytes?: number | null;
}
