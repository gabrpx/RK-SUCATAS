export type ClienteOrigem = 'balcao' | 'indicacao' | 'mercado_livre' | 'redes_sociais' | 'outro';
export type PreferenciaContato = 'whatsapp' | 'ligacao' | 'sms' | 'nenhuma';

export interface ClienteNota {
  id: string;
  cliente_id: string;
  texto: string;
  criado_por: string | null;
  autor: { id: string; nome_exibicao: string } | null;
  criado_em: string;
}

export interface Cliente {
  id: string;
  nome: string;
  telefone: string | null;
  documento: string | null;
  data_nascimento: string | null;
  origem: ClienteOrigem | null;
  preferencia_contato: PreferenciaContato | null;
  tags: string[];
  observacoes: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
  // Só presente na resposta de GET /:id (ficha completa) — a listagem não traz.
  notas?: ClienteNota[];
}

// Usado em joins de outras features (ex: Tarefa.cliente, Venda.cliente) —
// só o suficiente pra exibir e permitir contato, sem puxar o cadastro inteiro.
export interface ClienteResumo {
  id: string;
  nome: string;
  telefone: string | null;
}

export interface ClienteInput {
  nome: string;
  telefone?: string | null;
  documento?: string | null;
  data_nascimento?: string | null;
  origem?: ClienteOrigem | null;
  preferencia_contato?: PreferenciaContato | null;
  tags?: string[];
  observacoes?: string | null;
}

export type ClienteUpdateInput = Partial<ClienteInput> & { ativo?: boolean };
