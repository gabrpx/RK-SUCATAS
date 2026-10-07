import { api } from '../../utils/api';
import type { Cliente, ClienteInput, ClienteUpdateInput, ClienteNota, ClienteMoto, ClienteMotoInput, PecaProcurada, PecaProcuradaInput, PecaProcuradaStatus } from './types';
import type {
  ClienteDuplicidade,
  ClienteOperacionalInput,
  ClientesOperacaoFiltros,
  ClientesOperacaoPagina,
  ClientesResumoOperacional,
  PedidoBuscaAcao,
  PedidoBuscaEstadoPersistido,
  RegistrarPedidoOperacionalInput,
} from './operacaoTypes';

interface ApiResult<T> {
  success: boolean;
  data: T;
  error?: string;
}

function queryOperacao(filtros: ClientesOperacaoFiltros): string {
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor === undefined || valor === null || valor === '') continue;
    params.set(chave, String(valor));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export const clientesApi = {
  listar: (incluirInativos = false): Promise<ApiResult<Cliente[]>> =>
    api.get(`/api/clientes${incluirInativos ? '?incluir_inativos=true' : ''}`),
  buscar: (id: string): Promise<ApiResult<Cliente>> => api.get(`/api/clientes/${id}`),
  criar: (payload: ClienteInput): Promise<ApiResult<Cliente>> => api.post('/api/clientes', payload),
  atualizar: (id: string, payload: ClienteUpdateInput): Promise<ApiResult<Cliente>> => api.patch(`/api/clientes/${id}`, payload),
  desativar: (id: string): Promise<ApiResult<Cliente>> => api.patch(`/api/clientes/${id}`, { ativo: false }),
  reativar: (id: string): Promise<ApiResult<Cliente>> => api.patch(`/api/clientes/${id}`, { ativo: true }),
  banir: (id: string): Promise<ApiResult<Cliente>> => api.patch(`/api/clientes/${id}`, { banido: true }),
  desbanir: (id: string): Promise<ApiResult<Cliente>> => api.patch(`/api/clientes/${id}`, { banido: false }),
  adicionarNota: (id: string, texto: string): Promise<ApiResult<ClienteNota>> => api.post(`/api/clientes/${id}/notas`, { texto }),
  removerNota: (id: string, notaId: string): Promise<ApiResult<null>> => api.delete(`/api/clientes/${id}/notas/${notaId}`),

  criarMoto: (id: string, payload: ClienteMotoInput): Promise<ApiResult<ClienteMoto>> => api.post(`/api/clientes/${id}/motos`, payload),
  atualizarMoto: (id: string, motoId: string, payload: ClienteMotoInput): Promise<ApiResult<ClienteMoto>> => api.patch(`/api/clientes/${id}/motos/${motoId}`, payload),
  removerMoto: (id: string, motoId: string): Promise<ApiResult<null>> => api.delete(`/api/clientes/${id}/motos/${motoId}`),

  criarPecaProcurada: (id: string, payload: PecaProcuradaInput): Promise<ApiResult<PecaProcurada>> => api.post(`/api/clientes/${id}/pecas-procuradas`, payload),
  atualizarStatusPecaProcurada: (id: string, pedidoId: string, status: PecaProcuradaStatus): Promise<ApiResult<PecaProcurada>> =>
    api.patch(`/api/clientes/${id}/pecas-procuradas/${pedidoId}`, { status }),
  removerPecaProcurada: (id: string, pedidoId: string): Promise<ApiResult<PecaProcurada>> => api.delete(`/api/clientes/${id}/pecas-procuradas/${pedidoId}`),

  resumoOperacional: (): Promise<ApiResult<ClientesResumoOperacional>> =>
    api.get('/api/clientes/operacao/resumo'),
  listarOperacao: (filtros: ClientesOperacaoFiltros = {}): Promise<ApiResult<ClientesOperacaoPagina>> =>
    api.get(`/api/clientes/operacao/clientes${queryOperacao(filtros)}`),
  buscarOperacao: (id: string): Promise<ApiResult<Cliente & { eventos?: unknown[] }>> =>
    api.get(`/api/clientes/operacao/clientes/${id}`),
  buscarDuplicidades: (payload: Pick<ClienteOperacionalInput, 'nome' | 'telefone' | 'instagram_usuario'>): Promise<ApiResult<ClienteDuplicidade[]>> =>
    api.post('/api/clientes/operacao/duplicidades', payload),
  criarCliente: (payload: ClienteOperacionalInput): Promise<ApiResult<Cliente>> =>
    api.post('/api/clientes/operacao/clientes', payload),
  editarCliente: (id: string, payload: Partial<ClienteOperacionalInput>): Promise<ApiResult<Cliente>> =>
    api.patch(`/api/clientes/operacao/clientes/${id}`, payload),
  registrarPedido: (payload: RegistrarPedidoOperacionalInput): Promise<ApiResult<{ cliente: Cliente; pedido: PecaProcurada }>> =>
    api.post('/api/clientes/operacao/pedidos', payload),
  transicionarPedido: (
    pedidoId: string,
    status: PedidoBuscaEstadoPersistido,
    motivo?: string,
    vendaId?: string
  ): Promise<ApiResult<PecaProcurada>> =>
    api.patch(`/api/clientes/operacao/pedidos/${pedidoId}/status`, { status, motivo, venda_id: vendaId }),
  agirSobrePedido: (pedidoId: string, acao: PedidoBuscaAcao, motivo?: string): Promise<ApiResult<PecaProcurada>> =>
    api.post(`/api/clientes/operacao/pedidos/${pedidoId}/acao`, { acao, motivo }),
  definirMotoPrincipal: (clienteId: string, motoId: string): Promise<ApiResult<ClienteMoto>> =>
    api.patch(`/api/clientes/operacao/clientes/${clienteId}/moto-principal`, { moto_id: motoId }),
  corrigirOrigem: (clienteId: string, origem: string, motivo: string): Promise<ApiResult<Cliente>> =>
    api.patch(`/api/clientes/operacao/clientes/${clienteId}/origem`, { origem, motivo }),
};
