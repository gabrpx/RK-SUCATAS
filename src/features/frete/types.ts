import type { ClienteResumo } from '../clientes/types';

export type EnvioStatus = 'aguardando_postagem' | 'postado' | 'em_transito' | 'entregue' | 'problema' | 'cancelado';

export interface Envio {
  id: string;
  cliente_id: string | null;
  cliente_nome: string | null;
  cliente: ClienteResumo | null;
  venda_id: string | null;
  transportadora: string | null;
  servico: string | null;
  codigo_rastreio: string | null;
  // Só preenchido quando o envio foi de fato comprado via Melhor Envio — é o
  // que habilita o rastreio automático (ver src/server/routes/envios.ts).
  melhor_envio_order_id: string | null;
  cep_destino: string | null;
  valor_frete: number | null;
  status: EnvioStatus;
  status_detalhe: string | null;
  status_atualizado_em: string | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface EnvioInput {
  cliente_id?: string | null;
  cliente_nome?: string | null;
  venda_id?: string | null;
  transportadora?: string | null;
  servico?: string | null;
  codigo_rastreio?: string | null;
  melhor_envio_order_id?: string | null;
  cep_destino?: string | null;
  valor_frete?: number | null;
}

export type EnvioUpdateInput = Partial<EnvioInput> & { status?: EnvioStatus };
