// Chamadas HTTP do domínio de Gavetas (migration_061). Espelha o formato
// fino de src/features/estoque/api.ts: 1 função por rota de
// src/server/routes/gavetas.ts. moverPecaGaveta reaproveita
// estoqueApi.atualizarParcial — mover uma peça de gaveta é só um PATCH em
// estoque.gaveta_id (backend já aceita, ver src/server/routes/estoque.ts:473),
// não existe rota própria pra isso.
import { api } from '../../../utils/api';
import { estoqueApi } from '../api';
import type { Estoque, Gaveta, GavetaInput } from '../types';

interface ApiResult<T> {
  success: boolean;
  data: T;
  error?: string;
}

export const gavetasApi = {
  listar: () => api.get('/api/gavetas') as Promise<ApiResult<Gaveta[]>>,
  criar: (payload: GavetaInput) => api.post('/api/gavetas', payload) as Promise<ApiResult<Gaveta>>,
  atualizar: (id: string, payload: Partial<GavetaInput>) =>
    api.patch(`/api/gavetas/${id}`, payload) as Promise<ApiResult<Gaveta>>,
  excluir: (id: string) => api.delete(`/api/gavetas/${id}`) as Promise<ApiResult<null>>,

  moverPecaGaveta: (estoqueId: string, gavetaId: string | null) =>
    estoqueApi.atualizarParcial(estoqueId, { gaveta_id: gavetaId }) as Promise<ApiResult<Estoque>>,
};
