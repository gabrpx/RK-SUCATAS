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
  // Link do anúncio publicado (Mercado Livre / Facebook Marketplace) — null
  // quando a peça ainda não foi anunciada naquele canal.
  anuncio_ml_url: string | null;
  anuncio_fb_url: string | null;
  // Nomes das partes em que este item pode ser desmembrado na venda (ex:
  // ["Superior", "Inferior"]). null = item sempre vendido inteiro.
  componentes: string[] | null;
  // Unidades em estoque que já perderam alguma parte (vendida avulsa) — cada
  // entrada é 1 unidade física e o que já falta nela. Gerido pelo backend
  // via registrar_venda/cancelar_venda, nunca editado direto pelo formulário.
  unidades_incompletas: { faltando: string[] }[];
}

// Payload de criação/edição — o backend calcula id/codigo/timestamps.
export type EstoqueInput = Pick<
  Estoque,
  | 'nome'
  | 'categoria_id'
  | 'modelo_moto_id'
  | 'condicao'
  | 'nota_cadastro'
  | 'ano'
  | 'valor'
  | 'quantidade'
  | 'imagem_url'
  | 'descricao'
  | 'ativo'
  | 'componentes'
  | 'anuncio_ml_url'
  | 'anuncio_fb_url'
>;
