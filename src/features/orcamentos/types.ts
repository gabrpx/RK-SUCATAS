import type { ClienteResumo } from '../clientes/types';

export type OrcamentoStatus = 'aberto' | 'convertido' | 'cancelado';
export type DescontoTipo = 'fixo' | 'percentual';

export interface OrcamentoItem {
  id: string;
  orcamento_id: string;
  estoque_id: string | null;
  nome_item: string;
  componentes_disponiveis: string[] | null;
  componente: string | null;
  quantidade: number;
  valor_unitario: number;
  venda_id: string | null;
  criado_em: string;
}

export interface Orcamento {
  id: string;
  codigo: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  cliente_id: string | null;
  cliente?: ClienteResumo | null;
  desconto_tipo: DescontoTipo | null;
  desconto_valor: number;
  observacoes: string | null;
  validade: string | null;
  status: OrcamentoStatus;
  cancelado_em: string | null;
  criado_em: string;
  atualizado_em: string;
  itens: OrcamentoItem[];
}

export interface OrcamentoItemInput {
  estoque_id: string | null;
  nome_item: string;
  componentes_disponiveis: string[] | null;
  componente: string | null;
  quantidade: number;
  valor_unitario: number;
}

export interface OrcamentoInput {
  cliente_nome: string;
  cliente_telefone?: string | null;
  cliente_id?: string | null;
  desconto_tipo?: DescontoTipo | null;
  desconto_valor?: number;
  observacoes?: string | null;
  validade?: string | null;
  itens: OrcamentoItemInput[];
}

export interface OrcamentoHeaderInput {
  cliente_nome?: string;
  cliente_telefone?: string | null;
  cliente_id?: string | null;
  desconto_tipo?: DescontoTipo | null;
  desconto_valor?: number;
  observacoes?: string | null;
  validade?: string | null;
}

export interface VenderItemInput {
  forma_pagamento_id: string;
  componente?: string | null;
  data?: string;
}

export interface VenderTudoInput {
  forma_pagamento_id: string;
  data?: string;
}

export interface VenderTudoResultado {
  sucesso: string[];
  falhas: { itemId: string; error: string }[];
  orcamento: Orcamento;
}
