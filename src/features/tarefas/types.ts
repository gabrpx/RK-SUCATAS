export type TarefaStatus = 'pendente' | 'concluida';

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
  concluida_em: string | null;
  criado_em: string;
  atualizado_em: string;
  atribuido: UsuarioResumo | null;
  criador: UsuarioResumo | null;
}

export interface TarefaInput {
  titulo: string;
  descricao?: string | null;
  prazo?: string | null;
  atribuido_para: string;
}

export interface TarefaUpdateInput {
  titulo?: string;
  descricao?: string | null;
  prazo?: string | null;
  atribuido_para?: string;
}
