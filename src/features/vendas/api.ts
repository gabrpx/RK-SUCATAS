// Chamadas HTTP do módulo de Vendas.
import { api } from '../../utils/api';
import type { Venda, VendaInput } from './types';

interface ApiResult<T> {
  success: boolean;
  data: T;
  error?: string;
}

export const vendasApi = {
  listar: () => api.get('/api/vendas') as Promise<ApiResult<Venda[]>>,
  // POST chama registrar_venda no banco: baixa o estoque e já lança a entrada no caixa.
  registrar: (payload: VendaInput) => api.post('/api/vendas', payload) as Promise<ApiResult<Venda>>,
  // Só campos que não afetam o estoque (mudar quantidade/item exige cancelar e registrar de novo).
  atualizarParcial: (id: string, payload: Partial<Pick<Venda, 'forma_pagamento' | 'observacoes' | 'cliente_nome'>>) =>
    api.patch(`/api/vendas/${id}`, payload) as Promise<ApiResult<Venda>>,
  // DELETE chama cancelar_venda: devolve o estoque e remove a entrada de caixa vinculada.
  // Falha com 409 se a venda já tem recebimento de fiado (ver cancelarFiadoCompleto).
  cancelar: (id: string) => api.delete(`/api/vendas/${id}`) as Promise<ApiResult<null>>,
  // Reverte todos os recebimentos de fiado da venda (e as entradas de caixa
  // vinculadas) e só então cancela — pra quando a venda já foi quitada
  // (parcial ou total) e precisa ser desfeita mesmo assim. Só admin.
  cancelarFiadoCompleto: (id: string) => api.delete(`/api/vendas/${id}/fiado-completo`) as Promise<ApiResult<null>>,
};
