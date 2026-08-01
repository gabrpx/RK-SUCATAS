import type { Categoria, ModeloMoto } from '../../types/catalog';

// Peça original (retirada de moto sucateada na loja) vs paralela (compatível de terceiros).
export type CondicaoPeca = 'original' | 'paralela';

// Só se aplica (e é obrigatório) pra peças na categoria Motor ou subcategorias
// dela — ver src/features/estoque/categoriaMotor.ts.
export type NotaCadastro = 'com_nota' | 'sem_nota';

export interface Estoque {
  id: string;
  codigo: string;
  nome: string;
  categoria_id: string | null;
  categoria?: Categoria | null; // populado pelo backend via join, quando disponível
  modelo_moto_id: string | null;
  modelo_moto?: ModeloMoto | null;
  condicao: CondicaoPeca;
  nota_cadastro: NotaCadastro | null;
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
  'nome' | 'categoria_id' | 'modelo_moto_id' | 'condicao' | 'nota_cadastro' | 'ano' | 'valor' | 'quantidade' | 'imagem_url' | 'descricao' | 'ativo'
>;
