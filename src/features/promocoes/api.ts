// Chamadas HTTP do módulo de Promoções. Fino de propósito: cada função mapeia
// 1:1 pra uma rota do backend (src/server/routes/promocoes.ts).
import { api } from '../../utils/api';
import type { Promocao, PromocaoInput } from './types';

interface ApiResult<T> {
  success: boolean;
  data: T;
  error?: string;
}

export const promocoesApi = {
  listar: () => api.get('/api/promocoes') as Promise<ApiResult<Promocao[]>>,
  criar: (payload: PromocaoInput) => api.post('/api/promocoes', payload) as Promise<ApiResult<Promocao>>,
  atualizar: (id: string, payload: Partial<Pick<Promocao, 'valor' | 'descricao' | 'data_fim' | 'ativo'>>) =>
    api.patch(`/api/promocoes/${id}`, payload) as Promise<ApiResult<Promocao>>,
  excluir: (id: string) => api.delete(`/api/promocoes/${id}`) as Promise<ApiResult<null>>,
};
