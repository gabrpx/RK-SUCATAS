import type { ComprovantePixComVenda } from '../comprovantes/types';

export type ClienteOrigem = 'balcao' | 'indicacao' | 'mercado_livre' | 'redes_sociais' | 'outro';
export type PreferenciaContato = 'whatsapp' | 'ligacao' | 'sms' | 'nenhuma';

export interface ClienteNota {
  id: string;
  cliente_id: string;
  texto: string;
  criado_por: string | null;
  autor: { id: string; nome_exibicao: string } | null;
  criado_em: string;
}

// Moto que o cliente TEM (veículo físico) — diferente de ModeloMoto, que é o
// catálogo usado por estoque/vendas ("essa peça serve nesse modelo").
export interface ClienteMoto {
  id: string;
  cliente_id: string;
  modelo_moto_id: string | null;
  modelo_moto: { id: string; nome: string; ano: string | null } | null;
  placa: string | null;
  chassi: string | null;
  ano: string | null;
  cor: string | null;
  observacoes: string | null;
  criado_em: string;
}

export interface ClienteMotoInput {
  modelo_moto_id?: string | null;
  placa?: string | null;
  chassi?: string | null;
  ano?: string | null;
  cor?: string | null;
  observacoes?: string | null;
}

export type PecaProcuradaStatus = 'aguardando' | 'atendida' | 'cancelada';

export interface PecaProcurada {
  id: string;
  cliente_id: string | null;
  cliente_nome: string | null;
  descricao: string;
  categoria_id: string | null;
  categoria: { id: string; nome: string } | null;
  modelo_moto_id: string | null;
  modelo_moto: { id: string; nome: string; ano: string | null } | null;
  status: PecaProcuradaStatus;
  criado_por: string;
  criado_em: string;
  atendida_em: string | null;
}

export interface PecaProcuradaInput {
  descricao: string;
  categoria_id?: string | null;
  modelo_moto_id?: string | null;
}

export interface Cliente {
  id: string;
  nome: string;
  telefone: string | null;
  documento: string | null;
  data_nascimento: string | null;
  origem: ClienteOrigem | null;
  preferencia_contato: PreferenciaContato | null;
  tags: string[];
  observacoes: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
  // Vínculo manual com o comprador do Mercado Livre (ver migration_035) —
  // preenchido na importação de pedido, sem matching automático.
  ml_nickname?: string | null;
  // Só presentes na resposta de GET /:id (ficha completa) — a listagem não traz.
  notas?: ClienteNota[];
  motos?: ClienteMoto[];
  pecas_procuradas?: PecaProcurada[];
  // Comprovantes de PIX de TODAS as vendas do cliente, agregados pelo
  // backend (ver migration_036) — cada um traz o contexto de qual venda veio.
  comprovantes_pix?: ComprovantePixComVenda[];
}

// Usado em joins de outras features (ex: Tarefa.cliente, Venda.cliente) —
// só o suficiente pra exibir e permitir contato, sem puxar o cadastro inteiro.
export interface ClienteResumo {
  id: string;
  nome: string;
  telefone: string | null;
}

export interface ClienteInput {
  nome: string;
  telefone?: string | null;
  documento?: string | null;
  data_nascimento?: string | null;
  origem?: ClienteOrigem | null;
  preferencia_contato?: PreferenciaContato | null;
  tags?: string[];
  observacoes?: string | null;
}

export type ClienteUpdateInput = Partial<ClienteInput> & { ativo?: boolean };
