export interface FiadoBaixa {
  id: string;
  venda_id: string;
  quitado_por: string;
  quitado_em: string;
  observacao: string | null;
  usuario: { id: string; nome_exibicao: string } | null;
}

export interface FiadoBaixaInput {
  venda_id: string;
  observacao?: string | null;
}
