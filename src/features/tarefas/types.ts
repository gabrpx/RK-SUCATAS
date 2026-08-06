import type { ClienteResumo } from '../clientes/types';

export type TarefaStatus = 'pendente' | 'concluida';
export type TarefaPrioridade = 'baixa' | 'media' | 'alta';
export type TarefaTipo = 'geral' | 'visita';

export interface UsuarioResumo {
  id: string;
  nome_exibicao: string;
}

export interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  prazo: string | null;
  atribuido_para: string;
  criado_por: string;
  status: TarefaStatus;
  prioridade: TarefaPrioridade;
  tipo: TarefaTipo;
  cliente_id: string | null;
  concluida_em: string | null;
  criado_em: string;
  atualizado_em: string;
  atribuido: UsuarioResumo | null;
  criador: UsuarioResumo | null;
  cliente: ClienteResumo | null;
}

export interface TarefaInput {
  titulo: string;
  descricao?: string | null;
  prazo?: string | null;
  atribuido_para: string;
  cliente_id?: string | null;
  prioridade?: TarefaPrioridade;
  tipo?: TarefaTipo;
}

export interface TarefaUpdateInput {
  titulo?: string;
  descricao?: string | null;
  prazo?: string | null;
  atribuido_para?: string;
  cliente_id?: string | null;
  prioridade?: TarefaPrioridade;
  tipo?: TarefaTipo;
}
