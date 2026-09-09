import { api, BASE_URL } from '../../utils/api';
import type { Tarefa, TarefaInput, TarefaUpdateInput, UsuarioResumo } from './types';

interface ApiResult<T> {
  success: boolean;
  data: T;
  error?: string;
}

export const tarefasApi = {
  listar: (filtros?: { cliente_id?: string }): Promise<ApiResult<Tarefa[]>> =>
    api.get(`/api/tarefas${filtros?.cliente_id ? `?cliente_id=${filtros.cliente_id}` : ''}`),
  criar: (payload: TarefaInput): Promise<ApiResult<Tarefa>> => api.post('/api/tarefas', payload),
  atualizar: (id: string, payload: TarefaUpdateInput): Promise<ApiResult<Tarefa>> => api.patch(`/api/tarefas/${id}`, payload),
  concluir: (id: string): Promise<ApiResult<Tarefa>> => api.patch(`/api/tarefas/${id}/concluir`, {}),
  reabrir: (id: string): Promise<ApiResult<Tarefa>> => api.patch(`/api/tarefas/${id}/reabrir`, {}),
  excluir: (id: string): Promise<ApiResult<null>> => api.delete(`/api/tarefas/${id}`),
  listarResponsaveisPossiveis: (): Promise<ApiResult<UsuarioResumo[]>> => api.get('/api/usuarios/responsaveis-tarefa'),
  alternarItem: (tarefaId: string, itemId: string): Promise<ApiResult<Tarefa>> =>
    api.patch(`/api/tarefas/${tarefaId}/itens/${itemId}/toggle`, {}),
  alternarMinhaParticipacao: (tarefaId: string): Promise<ApiResult<Tarefa>> =>
    api.patch(`/api/tarefas/${tarefaId}/participantes/toggle`, {}),
  marcarLida: (tarefaId: string): Promise<ApiResult<null>> => api.patch(`/api/tarefas/${tarefaId}/marcar-lida`, {}),
  finalizar: (tarefaId: string): Promise<ApiResult<Tarefa>> => api.patch(`/api/tarefas/${tarefaId}/finalizar`, {}),
};

// Upload de imagem é multipart — não passa pelo helper `api` (que força
// Content-Type: application/json). Mesma rota genérica que o Estoque usa
// (POST /api/upload/imagem) — ver uploadImagemEstoque em features/estoque/api.ts.
export async function uploadImagemTarefa(file: File): Promise<{ success: boolean; url?: string; error?: string }> {
  const token = localStorage.getItem('auth_token');
  const formData = new FormData();
  formData.append('imagem', file);

  const response = await fetch(`${BASE_URL}/api/upload/imagem`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });
  return response.json();
}
