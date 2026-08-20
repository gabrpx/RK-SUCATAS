// Chamadas HTTP do módulo de Estoque. Fino de propósito: cada função mapeia
// 1:1 pra uma rota do backend (src/server/routes/estoque.ts).
import { api, BASE_URL } from '../../utils/api';
import type {
  Estoque,
  EstoqueInput,
  EstoqueUnidade,
  EstoqueUnidadeInput,
  EstoqueAnuncioMl,
  EstoqueAnuncioMlInput,
  ConfiguracaoAnuncioMlInput,
  ResultadoPublicacaoMl,
  EstatisticasAnuncioMl,
  EstoqueAnuncioShopee,
  ConfiguracaoAnuncioShopeeInput,
  ResultadoPublicacaoShopee,
} from './types';
import type { EstatisticasAnuncioShopee } from '../shopee/types';

interface ApiResult<T> {
  success: boolean;
  data: T;
  error?: string;
}

export const estoqueApi = {
  listar: () => api.get('/api/estoque') as Promise<ApiResult<Estoque[]>>,
  criar: (payload: EstoqueInput) => api.post('/api/estoque', payload) as Promise<ApiResult<Estoque>>,
  atualizar: (id: string, payload: Partial<EstoqueInput>) =>
    api.put(`/api/estoque/${id}`, payload) as Promise<ApiResult<Estoque>>,
  atualizarParcial: (id: string, payload: Partial<EstoqueInput>) =>
    api.patch(`/api/estoque/${id}`, payload) as Promise<ApiResult<Estoque>>,
  excluir: (id: string) => api.delete(`/api/estoque/${id}`) as Promise<ApiResult<null>>,
  excluirEmLote: (ids: string[]) =>
    api.post('/api/estoque/bulk-delete', { ids }) as Promise<ApiResult<null>>,
  atualizarCategoriaEmLote: (ids: string[], categoria_id: string) =>
    api.post('/api/estoque/bulk-update-categoria', { ids, categoria_id }) as Promise<ApiResult<null>>,
  ajustarQuantidadeEmLote: (ids: string[], delta: number) =>
    api.post('/api/estoque/bulk-update-quantidade', { ids, delta }) as Promise<ApiResult<null>>,

  // Fichas de unidade física desta peça — aninhadas no item porque não
  // existem fora dele (ver migration_014).
  listarUnidades: (estoqueId: string) => api.get(`/api/estoque/${estoqueId}/unidades`) as Promise<ApiResult<EstoqueUnidade[]>>,
  criarUnidade: (estoqueId: string, payload: EstoqueUnidadeInput) =>
    api.post(`/api/estoque/${estoqueId}/unidades`, payload) as Promise<ApiResult<EstoqueUnidade>>,
  atualizarUnidade: (estoqueId: string, unidadeId: string, payload: Partial<EstoqueUnidadeInput>) =>
    api.patch(`/api/estoque/${estoqueId}/unidades/${unidadeId}`, payload) as Promise<ApiResult<EstoqueUnidade>>,
  excluirUnidade: (estoqueId: string, unidadeId: string) =>
    api.delete(`/api/estoque/${estoqueId}/unidades/${unidadeId}`) as Promise<ApiResult<null>>,

  // Anúncios do Mercado Livre vinculados a esta peça — aninhados no item
  // porque não existem fora dele (ver migration_025).
  listarAnunciosMl: (estoqueId: string) => api.get(`/api/estoque/${estoqueId}/anuncios-ml`) as Promise<ApiResult<EstoqueAnuncioMl[]>>,
  criarAnuncioMl: (estoqueId: string, payload: EstoqueAnuncioMlInput) =>
    api.post(`/api/estoque/${estoqueId}/anuncios-ml`, payload) as Promise<ApiResult<EstoqueAnuncioMl>>,
  atualizarAnuncioMl: (estoqueId: string, linkId: string, payload: EstoqueAnuncioMlInput) =>
    api.patch(`/api/estoque/${estoqueId}/anuncios-ml/${linkId}`, payload) as Promise<ApiResult<EstoqueAnuncioMl>>,
  excluirAnuncioMl: (estoqueId: string, linkId: string) =>
    api.delete(`/api/estoque/${estoqueId}/anuncios-ml/${linkId}`) as Promise<ApiResult<null>>,

  // Publicação de anúncio NOVO no Mercado Livre (migration_043) — cria via
  // POST /items do lado do backend, diferente de criarAnuncioMl acima (que
  // só cola o link de um anúncio já existente). Ver EstoquePublicarMlModal.tsx.
  publicarMl: (estoqueId: string, payload: ConfiguracaoAnuncioMlInput) =>
    api.post(`/api/estoque/${estoqueId}/publicar-ml`, payload) as Promise<ApiResult<ResultadoPublicacaoMl>>,
  buscarEstatisticasAnuncioMl: (estoqueId: string, linkId: string) =>
    api.get(`/api/estoque/${estoqueId}/anuncios-ml/${linkId}/estatisticas`) as Promise<ApiResult<EstatisticasAnuncioMl | null>>,
  republicarAnuncioMl: (estoqueId: string, linkId: string) =>
    api.post(`/api/estoque/${estoqueId}/anuncios-ml/${linkId}/republicar`) as Promise<ApiResult<unknown>>,

  // Publicação de anúncio na Shopee (migration_045) — segundo canal,
  // companheiro do bloco do Mercado Livre acima. Ver EstoquePublicarShopeeModal.tsx.
  listarAnunciosShopee: (estoqueId: string) => api.get(`/api/estoque/${estoqueId}/anuncios-shopee`) as Promise<ApiResult<EstoqueAnuncioShopee[]>>,
  publicarShopee: (estoqueId: string, payload: ConfiguracaoAnuncioShopeeInput) =>
    api.post(`/api/estoque/${estoqueId}/publicar-shopee`, payload) as Promise<ApiResult<ResultadoPublicacaoShopee>>,
  buscarEstatisticasAnuncioShopee: (estoqueId: string, linkId: string) =>
    api.get(`/api/estoque/${estoqueId}/anuncios-shopee/${linkId}/estatisticas`) as Promise<ApiResult<EstatisticasAnuncioShopee | null>>,
  republicarAnuncioShopee: (estoqueId: string, linkId: string) =>
    api.post(`/api/estoque/${estoqueId}/anuncios-shopee/${linkId}/republicar`) as Promise<ApiResult<unknown>>,
};

// Upload de imagem é multipart — não passa pelo helper `api` (que força
// Content-Type: application/json). Usa fetch cru, com o mesmo token de auth.
export async function uploadImagemEstoque(file: File): Promise<{ success: boolean; url?: string; error?: string }> {
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
