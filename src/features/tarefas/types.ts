import type { ClienteResumo } from '../clientes/types';

export type TarefaStatus = 'pendente' | 'concluida';
export type TarefaPrioridade = 'baixa' | 'media' | 'alta';
export type TarefaTipo = 'geral' | 'visita';

export interface UsuarioResumo {
  id: string;
  nome_exibicao: string;
}

export interface TarefaItem {
  id: string;
  texto: string;
  concluido: boolean;
  ordem: number;
  concluido_em: string | null;
  concluido_por: string | null;
}

export interface TarefaItemInput {
  id?: string; // presente = item existente (diff no PATCH); ausente = novo
  texto: string;
}

export interface Tarefa {
  id: string;
  titulo: string | null;
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
  itens: TarefaItem[];
}

export interface TarefaInput {
  titulo?: string | null;
  descricao?: string | null;
  prazo?: string | null;
  atribuido_para: string;
  cliente_id?: string | null;
  prioridade?: TarefaPrioridade;
  tipo?: TarefaTipo;
  itens?: TarefaItemInput[];
}

export interface TarefaUpdateInput {
  titulo?: string | null;
  descricao?: string | null;
  prazo?: string | null;
  atribuido_para?: string;
  cliente_id?: string | null;
  prioridade?: TarefaPrioridade;
  tipo?: TarefaTipo;
  itens?: TarefaItemInput[];
}
