// Chamadas da organização física usadas só pelo novo estoque. Ficam aqui (e
// não em features/estoque/api.ts) para não alterar o contrato das telas
// antigas enquanto o novo módulo está em validação. Cada função mapeia 1:1
// para uma rota de src/server/routes/estoqueOrganizacao.ts.
import { api, BASE_URL } from '../../utils/api';
import type { EstoqueLocal, EstoqueLocalCategoria, EstoqueReserva, EstoqueUnidade } from '../estoque/types';

interface ApiResult<T> { success: boolean; data: T; error?: string }

/** Capacidades do banco detectadas pela API (migrations 067/068/069). */
export interface RecursosOrganizacao {
  clienteNaReserva: boolean;
  reservaComSinal: boolean;
  /** migration_069: baixa automática em venda sem unidade + edição atômica. */
  baixaAutomatica?: boolean;
}

export const RECURSOS_DEMONSTRACAO: RecursosOrganizacao = { clienteNaReserva: true, reservaComSinal: true, baixaAutomatica: true };

/** Venda registrada sem escolher a unidade: o banco baixou a mais antiga e a equipe confere. */
export interface BaixaPendente {
  id: string;
  venda_id: string;
  unidade_id: string;
  estoque_id: string;
  criada_em: string;
  venda?: { data: string; nome_item: string; cliente_nome: string | null; valor_total: number | null } | null;
}

/** Campos da ficha gravados pelo novo estoque (mesma regra da API). */
export interface UnidadeFichaPayload {
  valor?: number | null;
  condicao_nota?: number | null;
  fotos?: string[];
  endereco_id?: string | null;
  origem_identificacao?: string | null;
}

export interface ReservaComSinal extends EstoqueReserva {
  valor_sinal?: number | null;
  preco_referencia?: number | null;
  forma_pagamento_sinal_id?: string | null;
  criada_por_nome?: string | null;
}

export interface ReservaComSinalInput {
  clienteId: string | null;
  responsavel: string;
  dias: number;
  valorSinal: number;
  formaPagamentoId: string;
}

export type TipoEventoHistorico = 'cadastrada' | 'endereco' | 'reservada' | 'reserva_liberada' | 'reserva_vencida' | 'arquivada' | 'restaurada' | 'vendida'
  | 'editada' | 'baixa_automatica' | 'baixa_conferida' | 'baixa_corrigida' | 'baixa_desfeita' | 'baixa_excedente';

export interface EventoHistorico {
  tipo: TipoEventoHistorico;
  em: string;
  titulo: string;
  detalhe: string | null;
  autor: string | null;
}

export interface OrganizacaoResposta {
  locais: EstoqueLocal[];
  categorias: EstoqueLocalCategoria[];
  reservas: ReservaComSinal[];
  baixasPendentes?: BaixaPendente[];
  recursos?: RecursosOrganizacao;
}

export const organizacaoApi = {
  listar: () => api.get('/api/estoque/organizacao/locais') as Promise<ApiResult<OrganizacaoResposta>>,
  reservar: (unidadeId: string, entrada: ReservaComSinalInput) =>
    api.post(`/api/estoque/organizacao/unidades/${unidadeId}/reservas`, {
      responsavel: entrada.responsavel.trim() || null,
      cliente_id: entrada.clienteId,
      dias: entrada.dias,
      valor_sinal: entrada.valorSinal,
      forma_pagamento_id: entrada.formaPagamentoId,
    }) as Promise<ApiResult<ReservaComSinal>>,
  historico: (unidadeId: string) =>
    api.get(`/api/estoque/organizacao/unidades/${unidadeId}/historico`) as Promise<ApiResult<{ eventos: EventoHistorico[]; autoriaRegistrada: boolean }>>,
  atualizarLocal: (localId: string, payload: { codigo?: string; descricao?: string | null; ativo?: boolean }) =>
    api.patch(`/api/estoque/organizacao/locais/${localId}`, payload) as Promise<ApiResult<EstoqueLocal>>,
  definirPrioridadeCategoria: (localId: string, categoriaId: string, prioridade: 1 | 2 | 3) =>
    api.patch(`/api/estoque/organizacao/locais/${localId}/categorias/${categoriaId}`, { prioridade }) as Promise<ApiResult<EstoqueLocalCategoria>>,
  conferirBaixa: (baixaId: string, unidadeCorretaId: string | null) =>
    api.post(`/api/estoque/organizacao/baixas/${baixaId}/conferir`, { unidade_correta_id: unidadeCorretaId }) as Promise<ApiResult<BaixaPendente>>,
  /** Ficha que sobrou de venda antiga: marca como vendida sem mexer na quantidade. */
  baixarFichaExcedente: (unidadeId: string) =>
    api.post(`/api/estoque/organizacao/unidades/${unidadeId}/baixar-excedente`, {}) as Promise<ApiResult<EstoqueUnidade>>,
  /** Uma transação: ficha + preço + nota + fotos + endereço + origem. */
  criarUnidade: (pecaId: string, payload: UnidadeFichaPayload & { valor: number }) =>
    api.post(`/api/estoque/organizacao/pecas/${pecaId}/unidades`, payload) as Promise<ApiResult<EstoqueUnidade>>,
  /** Uma transação (migration_069): só as chaves enviadas mudam. */
  editarUnidade: (unidadeId: string, payload: UnidadeFichaPayload) =>
    api.post(`/api/estoque/organizacao/unidades/${unidadeId}/editar`, payload) as Promise<ApiResult<EstoqueUnidade>>,
  descartarFotos: (urls: string[]) =>
    api.post('/api/estoque/organizacao/fotos/descartar', { urls }) as Promise<ApiResult<{ descartadas: string[] }>>,
};

/** Upload multipart pela rota da organização, que registra o arquivo para descarte seguro se o cadastro falhar. */
export async function enviarFotoUnidade(file: File): Promise<{ success: boolean; url?: string; error?: string }> {
  const token = localStorage.getItem('auth_token');
  const formData = new FormData();
  formData.append('imagem', file);
  const response = await fetch(`${BASE_URL}/api/estoque/organizacao/fotos`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });
  return response.json();
}
