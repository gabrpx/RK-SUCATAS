// Chamadas HTTP do módulo de Caixa (livro de entradas e saídas).
import { api } from '../../utils/api';
import type { CaixaEntry, CaixaEntryInput } from './types';

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
