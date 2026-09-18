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
  concluido_por_usuario: UsuarioResumo | null;
}

export interface TarefaItemInput {
  id?: string; // presente = item existente (diff no PATCH); ausente = novo
  texto: string;
}

// Uma pessoa participando de uma tarefa multi-participante (checkboxes na
// criação, em vez do <select> de responsável único). Tarefa antiga (criada
// antes dessa feature) não tem nenhuma linha — só usa `atribuido_para`, sem
// mudança de comportamento (ver souParticipante em tarefas.ts).
export interface TarefaParticipante {
  id: string;
  usuario_id: string;
  concluido: boolean;
  concluido_em: string | null;
  lida: boolean;
  usuario: UsuarioResumo | null;
}

// Imagem anexada na tarefa (Fase 3) — upload via POST /api/upload/imagem
// existente, sem limite de quantidade além do bucket do Supabase Storage.
export interface TarefaImagem {
  id: string;
  url: string;
  ordem: number;
}

export interface Tarefa {
  id: string;
  titulo: string | null;
  descricao: string | null;
  prazo: string | null;
  atribuido_para: string;
  criado_por: string;
  status: TarefaStatus;
  pausada?: boolean;
  pausada_em?: string | null;
  pausada_por?: string | null;
  pausa_motivo?: string | null;
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
  // Opcional só pra não quebrar mocks/testes existentes que montam um Tarefa
  // na mão sem esse campo — a API real sempre devolve o array (vazio quando
  // a tarefa é do modelo antigo, de responsável único).
  participantes?: TarefaParticipante[];
  // Idem — vazio quando a tarefa não tem nenhuma imagem anexada.
  imagens?: TarefaImagem[];
}

export interface TarefaInput {
  titulo?: string | null;
  descricao?: string | null;
  prazo?: string | null;
  atribuido_para: string;
  // Quando presente (≥1 id), a criação usa o modelo novo de múltiplos
  // participantes (checkboxes) em vez do `atribuido_para` único — ver Fase 1
  // de tarefas.ts. Ignorado (e `atribuido_para` continua valendo sozinho)
  // fora da criação, ex: edição de uma tarefa já existente.
  participantes_ids?: string[];
  cliente_id?: string | null;
  prioridade?: TarefaPrioridade;
  tipo?: TarefaTipo;
  itens?: TarefaItemInput[];
  // URLs já hospedadas (POST /api/upload/imagem) — substitui a lista inteira
  // de tarefa_imagens quando presente (Fase 3).
  imagens?: string[];
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
  imagens?: string[];
}
