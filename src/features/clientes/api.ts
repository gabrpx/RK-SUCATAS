import { api } from '../../utils/api';
import type { Cliente, ClienteInput, ClienteUpdateInput, ClienteNota, ClienteMoto, ClienteMotoInput, PecaProcurada, PecaProcuradaInput, PecaProcuradaStatus } from './types';

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

  criarMoto: (id: string, payload: ClienteMotoInput): Promise<ApiResult<ClienteMoto>> => api.post(`/api/clientes/${id}/motos`, payload),
  atualizarMoto: (id: string, motoId: string, payload: ClienteMotoInput): Promise<ApiResult<ClienteMoto>> => api.patch(`/api/clientes/${id}/motos/${motoId}`, payload),
  removerMoto: (id: string, motoId: string): Promise<ApiResult<null>> => api.delete(`/api/clientes/${id}/motos/${motoId}`),

  criarPecaProcurada: (id: string, payload: PecaProcuradaInput): Promise<ApiResult<PecaProcurada>> => api.post(`/api/clientes/${id}/pecas-procuradas`, payload),
  atualizarStatusPecaProcurada: (id: string, pedidoId: string, status: PecaProcuradaStatus): Promise<ApiResult<PecaProcurada>> =>
    api.patch(`/api/clientes/${id}/pecas-procuradas/${pedidoId}`, { status }),
  removerPecaProcurada: (id: string, pedidoId: string): Promise<ApiResult<null>> => api.delete(`/api/clientes/${id}/pecas-procuradas/${pedidoId}`),
};
