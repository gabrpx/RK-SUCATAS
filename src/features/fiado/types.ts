export interface FiadoRecebimento {
  id: string;
  venda_id: string;
  valor: number;
  forma_pagamento_id: string;
  forma_pagamento: { id: string; nome: string } | null;
  caixa_id: string | null;
  recebido_por: string;
  recebido_em: string;
  usuario: { id: string; nome_exibicao: string } | null;
}

export interface FiadoRecebimentoInput {
  venda_id: string;
  valor: number;
  forma_pagamento_id: string;
}
