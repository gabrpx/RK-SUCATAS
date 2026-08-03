import { api } from '../../utils/api';
import type { Tarefa, TarefaInput, TarefaUpdateInput, UsuarioResumo } from './types';

interface ApiResult<T> {
  success: boolean;
  data: T;
  error?: string;
}

export const tarefasApi = {
  listar: (): Promise<ApiResult<Tarefa[]>> => api.get('/api/tarefas'),
  criar: (payload: TarefaInput): Promise<ApiResult<Tarefa>> => api.post('/api/tarefas', payload),
  atualizar: (id: string, payload: TarefaUpdateInput): Promise<ApiResult<Tarefa>> => api.patch(`/api/tarefas/${id}`, payload),
  concluir: (id: string): Promise<ApiResult<Tarefa>> => api.patch(`/api/tarefas/${id}/concluir`, {}),
  reabrir: (id: string): Promise<ApiResult<Tarefa>> => api.patch(`/api/tarefas/${id}/reabrir`, {}),
  excluir: (id: string): Promise<ApiResult<null>> => api.delete(`/api/tarefas/${id}`),
  listarResponsaveisPossiveis: (): Promise<ApiResult<UsuarioResumo[]>> => api.get('/api/usuarios/responsaveis-tarefa'),
};
