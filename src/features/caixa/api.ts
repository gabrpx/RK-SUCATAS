// Chamadas HTTP do módulo de Caixa (livro de entradas e saídas).
import { api, BASE_URL } from '../../utils/api';
import type { CaixaEntry, CaixaEntryInput, CaixaPendencia, CaixaPendenciaInput, CaixaPendenciaUpdateInput, CaixaPendenciaRecebimento, CaixaPendenciaRecebimentoInput, Cobranca, CobrancaInput } from './types';

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
  atualizar: (pendenciaId: string, payload: CaixaPendenciaUpdateInput) =>
    api.patch(`/api/caixa-pendencias/${pendenciaId}`, payload) as Promise<ApiResult<CaixaPendencia>>,
  registrarRecebimento: (pendenciaId: string, payload: CaixaPendenciaRecebimentoInput) =>
    api.post(`/api/caixa-pendencias/${pendenciaId}/recebimentos`, payload) as Promise<ApiResult<CaixaPendenciaRecebimento>>,
  removerRecebimento: (pendenciaId: string, recebimentoId: string) =>
    api.delete(`/api/caixa-pendencias/${pendenciaId}/recebimentos/${recebimentoId}`) as Promise<ApiResult<null>>,
  excluir: (pendenciaId: string) => api.delete(`/api/caixa-pendencias/${pendenciaId}`) as Promise<ApiResult<null>>,
};

export const cobrancasApi = {
  listar: () => api.get('/api/cobrancas') as Promise<ApiResult<Cobranca[]>>,
  criar: (payload: CobrancaInput) => api.post('/api/cobrancas', payload) as Promise<ApiResult<Cobranca>>,
  atualizar: (id: string, payload: Partial<CobrancaInput & { timer_ativo: boolean }>) =>
    api.patch(`/api/cobrancas/${id}`, payload) as Promise<ApiResult<Cobranca>>,
  registrarEnvio: (id: string) => api.post(`/api/cobrancas/${id}/registrar-envio`, {}) as Promise<ApiResult<Cobranca>>,
  excluir: (id: string) => api.delete(`/api/cobrancas/${id}`) as Promise<ApiResult<null>>,
};

export async function anexarBoletoCobranca(file: File): Promise<{ success: boolean; storage_path?: string; nome_arquivo?: string; tipo_mime?: string; tamanho_bytes?: number; error?: string }> {
  const token = localStorage.getItem('auth_token');
  const formData = new FormData();
  formData.append('arquivo', file);

  const resp = await fetch(`${BASE_URL}/api/upload/comprovante`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });
  return resp.json();
}
