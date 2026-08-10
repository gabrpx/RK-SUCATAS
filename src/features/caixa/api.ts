// Chamadas HTTP do módulo de Caixa (livro de entradas e saídas).
import { api } from '../../utils/api';
import type { CaixaEntry, CaixaEntryInput, CaixaPendencia, CaixaPendenciaInput, CaixaPendenciaRecebimento, CaixaPendenciaRecebimentoInput } from './types';

interface ApiResult<T> {
  success: boolean;
  data: T;
  error?: string;
}

export const caixaApi = {
  listar: () => api.get('/api/caixa') as Promise<ApiResult<CaixaEntry[]>>,
  lancar: (payload: CaixaEntryInput) => api.post('/api/caixa', payload) as Promise<ApiResult<CaixaEntry>>,
  atualizar: (id: string, payload: Partial<CaixaEntryInput>) =>
    api.put(`/api/caixa/${id}`, payload) as Promise<ApiResult<CaixaEntry>>,
  excluir: (id: string) => api.delete(`/api/caixa/${id}`) as Promise<ApiResult<null>>,
};

export const caixaPendenciasApi = {
  listar: () => api.get('/api/caixa-pendencias') as Promise<ApiResult<CaixaPendencia[]>>,
  listarRecebimentos: () => api.get('/api/caixa-pendencias/recebimentos') as Promise<ApiResult<CaixaPendenciaRecebimento[]>>,
  criar: (payload: CaixaPendenciaInput) => api.post('/api/caixa-pendencias', payload) as Promise<ApiResult<CaixaPendencia>>,
  registrarRecebimento: (pendenciaId: string, payload: CaixaPendenciaRecebimentoInput) =>
    api.post(`/api/caixa-pendencias/${pendenciaId}/recebimentos`, payload) as Promise<ApiResult<CaixaPendenciaRecebimento>>,
  removerRecebimento: (pendenciaId: string, recebimentoId: string) =>
    api.delete(`/api/caixa-pendencias/${pendenciaId}/recebimentos/${recebimentoId}`) as Promise<ApiResult<null>>,
  excluir: (pendenciaId: string) => api.delete(`/api/caixa-pendencias/${pendenciaId}`) as Promise<ApiResult<null>>,
};
