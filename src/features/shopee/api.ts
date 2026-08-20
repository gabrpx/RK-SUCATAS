// Chamadas HTTP do módulo Shopee. Fino de propósito: cada função mapeia 1:1
// pra uma rota do backend (src/server/routes/shopee.ts). Companheiro de
// src/features/mercadolivre/api.ts.
import { api } from '../../utils/api';
import type { CategoriaShopeeNo, AtributoShopee, CanalLogisticaSugestao } from './types';

interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ShopeeStatus {
  success: boolean;
  conectado: boolean;
  shop_id: string | null;
}

export interface DetalheCategoriaShopee {
  categoria: CategoriaShopeeNo | null;
  filhos: CategoriaShopeeNo[];
  // Só vem preenchido quando a categoria é folha (sem filhos) — categoria
  // com filhos ainda não é publicável, ver src/server/routes/shopee.ts.
  atributos: AtributoShopee[];
}

export const shopeeApi = {
  status: () => api.get('/api/shopee/status') as Promise<ShopeeStatus>,
  iniciarLogin: () => api.get('/api/shopee/auth/login') as Promise<ApiResult<never> & { url: string }>,
  desconectar: () => api.delete('/api/shopee/desconectar') as Promise<ApiResult<null>>,

  buscarConfiguracao: () => api.get('/api/shopee/configuracoes') as Promise<ApiResult<{ margemPercentual: number }>>,
  atualizarConfiguracao: (margemPercentual: number) =>
    api.patch('/api/shopee/configuracoes', { margem_percentual: margemPercentual }) as Promise<ApiResult<{ margemPercentual: number }>>,

  // Navegação manual em árvore — sem parâmetro devolve a raiz.
  buscarCategoriasRaiz: () => api.get('/api/shopee/categorias') as Promise<ApiResult<CategoriaShopeeNo[]>>,
  buscarCategoria: (categoriaId: number) => api.get(`/api/shopee/categorias/${categoriaId}`) as Promise<ApiResult<DetalheCategoriaShopee>>,

  buscarCanaisLogistica: () => api.get('/api/shopee/canais-logistica') as Promise<ApiResult<CanalLogisticaSugestao>>,
};
