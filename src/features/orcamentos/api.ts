// CRUD de orçamentos. Vender (item ou tudo) chama registrar_venda no backend
// via a mesma RPC usada em Vendas — aqui só orquestramos e refletimos o
// resultado (a fonte de verdade do estoque continua sendo o backend).
import { api } from '../../utils/api';
import type { Orcamento, OrcamentoInput, OrcamentoItemInput, OrcamentoHeaderInput, VenderItemInput, VenderTudoInput, VenderTudoResultado } from './types';

interface ApiResult<T> {
  success: boolean;
  data: T;
  error?: string;
}

export const orcamentosApi = {
  listar: (): Promise<ApiResult<Orcamento[]>> => api.get('/api/orcamentos'),
  criar: (payload: OrcamentoInput): Promise<ApiResult<Orcamento>> => api.post('/api/orcamentos', payload),
  atualizar: (id: string, payload: OrcamentoHeaderInput): Promise<ApiResult<Orcamento>> => api.patch(`/api/orcamentos/${id}`, payload),
  cancelar: (id: string): Promise<ApiResult<Orcamento>> => api.patch(`/api/orcamentos/${id}/cancelar`, {}),
  adicionarItem: (id: string, item: OrcamentoItemInput): Promise<ApiResult<Orcamento>> => api.post(`/api/orcamentos/${id}/itens`, item),
  atualizarItem: (id: string, itemId: string, payload: { valor_unitario?: number; quantidade?: number }): Promise<ApiResult<Orcamento>> =>
    api.patch(`/api/orcamentos/${id}/itens/${itemId}`, payload),
  removerItem: (id: string, itemId: string): Promise<ApiResult<Orcamento>> => api.delete(`/api/orcamentos/${id}/itens/${itemId}`),
  venderItem: (id: string, itemId: string, payload: VenderItemInput): Promise<ApiResult<{ venda: any; orcamento: Orcamento }>> =>
    api.post(`/api/orcamentos/${id}/itens/${itemId}/vender`, payload),
  venderTudo: (id: string, payload: VenderTudoInput): Promise<ApiResult<VenderTudoResultado>> => api.post(`/api/orcamentos/${id}/vender-tudo`, payload),
};
