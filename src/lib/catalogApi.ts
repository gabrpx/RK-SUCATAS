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
  // Memoriza a categoria do Mercado Livre escolhida na publicação (migration_043)
  // — só uma sugestão pra próxima peça desta categoria interna, nunca uma trava.
  memorizarCategoriaMlPadrao: (id: string, mercadolivreCategoriaId: string) =>
    api.put(`/api/categorias/${id}`, { mercadolivre_categoria_id_padrao: mercadolivreCategoriaId }) as Promise<ApiResult<Categoria>>,
  reordenar: (ids: string[]) => api.patch('/api/categorias/reordenar', { ids }) as Promise<ApiResult<null>>,
  excluir: (id: string) => api.delete(`/api/categorias/${id}`) as Promise<ApiResult<null>>,
};

export const modelosMotoApi = {
  listar: () => api.get('/api/modelos-moto') as Promise<ApiResult<ModeloMoto[]>>,
  criar: (nome: string, parent_id?: string | null, ano?: string | null, imagem_url?: string | null) =>
    api.post('/api/modelos-moto', { nome, parent_id: parent_id ?? null, ano: ano ?? null, imagem_url: imagem_url ?? null }) as Promise<ApiResult<ModeloMoto>>,
  rapido: (marca: string, cilindrada: string | null, nome: string, ano?: string | null, imagem_url?: string | null) =>
    api.post('/api/modelos-moto/rapido', { marca, cilindrada, nome, ano, imagem_url }) as Promise<
      ApiResult<{ marca: ModeloMoto; cilindrada: ModeloMoto | null; moto: ModeloMoto }>
    >,
  renomear: (id: string, nome: string, ano?: string | null, imagem_url?: string | null) =>
    api.put(`/api/modelos-moto/${id}`, { nome, ano, imagem_url }) as Promise<ApiResult<ModeloMoto>>,
  mover: (id: string, parent_id: string | null) => api.put(`/api/modelos-moto/${id}`, { parent_id }) as Promise<ApiResult<ModeloMoto>>,
  reordenar: (ids: string[]) => api.patch('/api/modelos-moto/reordenar', { ids }) as Promise<ApiResult<null>>,
  excluir: (id: string) => api.delete(`/api/modelos-moto/${id}`) as Promise<ApiResult<null>>,
};

export const formasPagamentoApi = {
  listar: () => api.get('/api/formas-pagamento') as Promise<ApiResult<FormaPagamento[]>>,
  criar: (nome: string, natureza?: 'avista' | 'fiado') => api.post('/api/formas-pagamento', { nome, natureza }) as Promise<ApiResult<FormaPagamento>>,
  renomear: (id: string, nome: string) => api.put(`/api/formas-pagamento/${id}`, { nome }) as Promise<ApiResult<FormaPagamento>>,
  // Fiado: hoje só "PENDÊNCIA" nasce assim (migration_030) — este toggle deixa
  // marcar outras formas de pagamento (ex: um carnê novo) sem precisar SQL.
  atualizarNatureza: (id: string, natureza: 'avista' | 'fiado') => api.put(`/api/formas-pagamento/${id}`, { natureza }) as Promise<ApiResult<FormaPagamento>>,
  excluir: (id: string) => api.delete(`/api/formas-pagamento/${id}`) as Promise<ApiResult<null>>,
};
