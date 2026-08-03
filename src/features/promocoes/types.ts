// Promoção: desconto com prazo aplicado a uma peça específica, um modelo de
// moto (vale pra ele e toda a subárvore de variações abaixo — ver
// src/features/motos/motoTree.ts), uma categoria (mesma lógica de subárvore)
// ou o estoque inteiro. Sem job/cron pra expirar: o backend calcula quem
// está com desconto ativo agora comparando a janela de datas no momento da
// consulta (ver src/server/routes/estoque.ts).
export type EscopoPromocao = 'peca' | 'modelo_moto' | 'categoria' | 'global';
export type TipoDesconto = 'percentual' | 'valor_fixo';

export interface Promocao {
  id: string;
  escopo: EscopoPromocao;
  /** null só quando escopo === 'global' */
  alvo_id: string | null;
  tipo_desconto: TipoDesconto;
  valor: number;
  descricao: string | null;
  data_inicio: string;
  /** null = sem prazo definido, só termina quando alguém desativar/excluir */
  data_fim: string | null;
  ativo: boolean;
  criado_em: string;
}

export type PromocaoInput = Pick<Promocao, 'escopo' | 'alvo_id' | 'tipo_desconto' | 'valor' | 'descricao' | 'data_inicio' | 'data_fim'>;

// Anexado pelo backend a cada item de estoque com desconto vigente agora —
// já vem com o valor promocional calculado, pra tela não duplicar a conta.
export interface PromocaoAtiva {
  id: string;
  escopo: EscopoPromocao;
  tipo_desconto: TipoDesconto;
  valor: number;
  valor_original: number;
  valor_promocional: number;
  data_fim: string | null;
  descricao: string | null;
}
