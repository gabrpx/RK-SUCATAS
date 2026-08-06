import { api } from '../../utils/api';
import type { Cliente, ClienteInput, ClienteUpdateInput, ClienteNota } from './types';

interface ApiResult<T> {
  success: boolean;
  data: T;
  error?: string;
}

export const clientesApi = {
  listar: (incluirInativos = false): Promise<ApiResult<Cliente[]>> =>
    api.get(`/api/clientes${incluirInativos ? '?incluir_inativos=true' : ''}`),
  buscar: (id: string): Promise<ApiResult<Cliente>> => api.get(`/api/clientes/${id}`),
  criar: (payload: ClienteInput): Promise<ApiResult<Cliente>> => api.post('/api/clientes', payload),
  atualizar: (id: string, payload: ClienteUpdateInput): Promise<ApiResult<Cliente>> => api.patch(`/api/clientes/${id}`, payload),
  desativar: (id: string): Promise<ApiResult<Cliente>> => api.patch(`/api/clientes/${id}`, { ativo: false }),
  reativar: (id: string): Promise<ApiResult<Cliente>> => api.patch(`/api/clientes/${id}`, { ativo: true }),
  adicionarNota: (id: string, texto: string): Promise<ApiResult<ClienteNota>> => api.post(`/api/clientes/${id}/notas`, { texto }),
  removerNota: (id: string, notaId: string): Promise<ApiResult<null>> => api.delete(`/api/clientes/${id}/notas/${notaId}`),
};
