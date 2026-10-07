export type PedidoBuscaEstadoPersistido =
  | 'nova'
  | 'em_busca'
  | 'peca_disponivel'
  | 'aguardando_cliente'
  | 'vendida'
  | 'nao_encontrada'
  | 'cliente_desistiu'
  | 'cancelada'
  | 'aguardando'
  | 'atendida';

export type PedidoBuscaSituacao = PedidoBuscaEstadoPersistido | 'reservada' | 'visita_agendada';

export type PedidoBuscaAcao =
  | 'iniciar_busca'
  | 'cliente_avisado'
  | 'cliente_desistiu'
  | 'aguardando_resposta'
  | 'vai_buscar'
  | 'nao_quer_mais'
  | 'marcar_nao_encontrada'
  | 'cancelar'
  | 'reabrir';

export type MatchDecisao = 'confirmar' | 'nao_compativel';

export type VisitaStatus = 'agendada' | 'confirmada' | 'compareceu' | 'nao_compareceu' | 'reagendada' | 'cancelada';

export type ReservaOperacionalStatus = 'ativa' | 'decisao_pendente' | 'liberada' | 'vendida';

export type SituacaoClienteCodigo =
  | 'visita_atrasada'
  | 'visita_hoje'
  | 'promessa_vencida'
  | 'reserva_vencida'
  | 'reserva_vencendo'
  | 'aguardando_retirada'
  | 'peca_disponivel'
  | 'aguardando_resposta'
  | 'busca_antiga'
  | 'visita_agendada'
  | 'pedido_novo'
  | 'procurando_peca'
  | 'sem_pendencias';

export type SituacaoClienteNivel = 'critico' | 'atencao' | 'informativo' | 'neutro';

export interface PedidoBuscaOperacional {
  id: string;
  status: PedidoBuscaEstadoPersistido;
  criadoEm: string;
  descricao?: string | null;
  prometidoPara?: string | null;
  proximaAcaoEm?: string | null;
}

export interface VisitaOperacional {
  id: string;
  status: VisitaStatus;
  para: string;
}

export interface ReservaOperacional {
  id: string;
  status: ReservaOperacionalStatus;
  reservadaAte: string;
}

export interface ClienteOperacaoEntrada {
  id?: string;
  pedidos: PedidoBuscaOperacional[];
  visitas: VisitaOperacional[];
  reservas: ReservaOperacional[];
}

export interface SituacaoCliente {
  codigo: SituacaoClienteCodigo;
  rotulo: string;
  nivel: SituacaoClienteNivel;
  proximaAcaoEm: string | null;
}

export interface ClientesOperacaoCapabilities {
  base: boolean;
  visitas: boolean;
  reservas: boolean;
  matches: boolean;
}

export interface ClientesResumoOperacional {
  total_clientes: number;
  pedidos_por_status: Partial<Record<PedidoBuscaEstadoPersistido, number>>;
  pendencias_por_idade: {
    ate_2_dias: number;
    de_3_a_7_dias: number;
    mais_de_7_dias: number;
  };
  respostas_acima_48h: number;
  reservas_sem_decisao: number;
  visitas_vencidas: number;
  decisoes_duplicidade: number;
  capabilities: ClientesOperacaoCapabilities;
  visitas: unknown[];
  reservas: unknown[];
  matches: unknown[];
}

export interface ClienteOperacaoListaItem {
  id: string;
  nome: string;
  telefone: string | null;
  instagram_usuario: string | null;
  preferencia_contato: string | null;
  origem: string | null;
  cidade: string | null;
  estado: string | null;
  ativo: boolean;
  banido: boolean;
  criado_em: string;
  atualizado_em: string;
  motos: unknown[];
  pedidos: unknown[];
}

export interface ClientesOperacaoPagina {
  itens: ClienteOperacaoListaItem[];
  proximo_cursor: string | null;
}

export interface ClientesOperacaoFiltros {
  cursor?: string | null;
  limit?: number;
  cidade?: string;
  origem?: string;
  responsavel?: string;
  busca?: string;
  ativo?: boolean;
  cadastroIncompleto?: boolean;
  semPendencias?: boolean;
}

export interface ClienteOperacionalInput {
  id?: string;
  nome: string;
  telefone?: string | null;
  instagram_usuario?: string | null;
  preferencia_contato: 'whatsapp' | 'instagram';
  origem: 'whatsapp' | 'facebook' | 'mercado_livre' | 'instagram' | 'indicacao' | 'balcao';
  documento?: string | null;
  data_nascimento?: string | null;
  tags?: string[];
  observacoes?: string | null;
  cidade: string;
  estado: string;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  moto?: {
    modelo_moto_id?: string | null;
    modelo_texto?: string | null;
    placa?: string | null;
    chassi?: string | null;
    ano?: string | null;
    cor?: string | null;
    observacoes?: string | null;
  };
  duplicidade_decisao?: 'sugerida' | 'reutilizada' | 'confirmada_separada';
  duplicidade_criterios?: Array<'nome' | 'whatsapp' | 'instagram'>;
}

export interface PedidoOperacionalInput {
  descricao: string;
  cliente_moto_id?: string | null;
  modelo_moto_id?: string | null;
  moto_modelo_texto?: string | null;
  categoria_id?: string | null;
  ano_compatibilidade?: string | null;
  observacoes?: string | null;
  responsavel_id?: string;
  prometido_para?: string | null;
  idempotency_key: string;
}

export interface RegistrarPedidoOperacionalInput {
  cliente: ClienteOperacionalInput;
  pedido: PedidoOperacionalInput;
}

export interface ClienteDuplicidade {
  id: string;
  nome: string;
  telefone: string | null;
  instagram_usuario: string | null;
  cidade: string | null;
  estado: string | null;
  ativo: boolean;
  criterios: Array<'nome' | 'whatsapp' | 'instagram'>;
}
