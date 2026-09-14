import { api } from '../../utils/api';
import type { Lembrete, LembreteInput, LembreteUpdateInput, UsuarioResumo } from './types';

interface ApiResult<T> {
  success: boolean;
  data: T;
  error?: string;
}

export const lembretesApi = {
  listar: (filtros?: { status?: string }): Promise<ApiResult<Lembrete[]>> =>
    api.get(`/api/lembretes${filtros?.status ? `?status=${filtros.status}` : ''}`),
  criar: (payload: LembreteInput): Promise<ApiResult<Lembrete>> => api.post('/api/lembretes', payload),
  atualizar: (id: string, payload: LembreteUpdateInput): Promise<ApiResult<Lembrete>> => api.patch(`/api/lembretes/${id}`, payload),
  concluir: (id: string): Promise<ApiResult<Lembrete>> => api.patch(`/api/lembretes/${id}/concluir`, {}),
  reabrir: (id: string): Promise<ApiResult<Lembrete>> => api.patch(`/api/lembretes/${id}/reabrir`, {}),
  excluir: (id: string): Promise<ApiResult<null>> => api.delete(`/api/lembretes/${id}`),
  listarUsuariosAtivos: (): Promise<ApiResult<UsuarioResumo[]>> => api.get('/api/usuarios/ativos-resumo'),
};
