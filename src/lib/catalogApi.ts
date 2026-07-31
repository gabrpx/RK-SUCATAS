// Chamadas HTTP das tabelas de apoio (categorias, modelos de moto, formas de
// pagamento) — usadas por mais de uma feature (Estoque, Vendas, Caixa), por
// isso ficam num lugar neutro em vez de dentro de uma feature específica.
import { api } from '../utils/api';
import type { Categoria, ModeloMoto, FormaPagamento } from '../types/catalog';

interface ApiResult<T> {
  success: boolean;
  data: T;
  error?: string;
}

export const categoriasApi = {
  listar: () => api.get('/api/categorias') as Promise<ApiResult<Categoria[]>>,
  criar: (nome: string, parent_id?: string | null) =>
    api.post('/api/categorias', { nome, parent_id: parent_id ?? null }) as Promise<ApiResult<Categoria>>,
  renomear: (id: string, nome: string) => api.put(`/api/categorias/${id}`, { nome }) as Promise<ApiResult<Categoria>>,
  mover: (id: string, parent_id: string | null) => api.put(`/api/categorias/${id}`, { parent_id }) as Promise<ApiResult<Categoria>>,
  reordenar: (ids: string[]) => api.patch('/api/categorias/reordenar', { ids }) as Promise<ApiResult<null>>,
  excluir: (id: string) => api.delete(`/api/categorias/${id}`) as Promise<ApiResult<null>>,
};

export const modelosMotoApi = {
  listar: () => api.get('/api/modelos-moto') as Promise<ApiResult<ModeloMoto[]>>,
  criar: (nome: string, marca?: string) =>
    api.post('/api/modelos-moto', { nome, marca }) as Promise<ApiResult<ModeloMoto>>,
  excluir: (id: string) => api.delete(`/api/modelos-moto/${id}`) as Promise<ApiResult<null>>,
};

export const formasPagamentoApi = {
  listar: () => api.get('/api/formas-pagamento') as Promise<ApiResult<FormaPagamento[]>>,
  criar: (nome: string) => api.post('/api/formas-pagamento', { nome }) as Promise<ApiResult<FormaPagamento>>,
  renomear: (id: string, nome: string) => api.put(`/api/formas-pagamento/${id}`, { nome }) as Promise<ApiResult<FormaPagamento>>,
  excluir: (id: string) => api.delete(`/api/formas-pagamento/${id}`) as Promise<ApiResult<null>>,
};
