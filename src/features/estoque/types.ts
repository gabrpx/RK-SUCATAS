import type { Categoria, ModeloMoto } from '../../types/catalog';

// Peça original (retirada de moto sucateada na loja) vs paralela (compatível de terceiros).
export type CondicaoPeca = 'original' | 'paralela';

export interface Estoque {
  id: string;
  codigo: string;
  nome: string;
  categoria_id: string | null;
  categoria?: Categoria | null; // populado pelo backend via join, quando disponível
  modelo_moto_id: string | null;
  modelo_moto?: ModeloMoto | null;
  condicao: CondicaoPeca;
  ano: string | null;
  valor: number;
  quantidade: number;
  imagem_url: string | null;
  descricao: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

// Payload de criação/edição — o backend calcula id/codigo/timestamps.
export type EstoqueInput = Pick<
  Estoque,
  'nome' | 'categoria_id' | 'modelo_moto_id' | 'condicao' | 'ano' | 'valor' | 'quantidade' | 'imagem_url' | 'descricao' | 'ativo'
>;
