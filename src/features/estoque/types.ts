import type { Categoria, ModeloMoto } from '../../types/catalog';
import type { PromocaoAtiva } from '../promocoes/types';

// Peça original (retirada de moto sucateada na loja) vs paralela (compatível de terceiros).
export type CondicaoPeca = 'original' | 'paralela';

// Só se aplica (e é obrigatório) pra peças na categoria Motor ou subcategorias
// dela — ver src/features/estoque/categoriaMotor.ts.
export type NotaCadastro = 'com_nota' | 'sem_nota';

// Ficha de uma unidade física específica dentro da mesma linha de estoque —
// ver supabase/migration_014_unidades_avaria.sql. Só existe pra unidade que
// tem algo diferente das outras (5 TBI iguais, 1 amassado = 1 ficha só).
export interface EstoqueUnidade {
  id: string;
  estoque_id: string;
  /** Como a loja chama essa unidade: "A amassada", "Sem bico injetor" */
  apelido: string | null;
  avaria: boolean;
  avaria_descricao: string | null;
  /** Fotos do defeito — separadas de estoque.imagens, que mostra a peça boa */
  fotos: string[];
  /** null = vale o preço normal da peça; preenchido = preço só desta unidade */
  valor: number | null;
  criado_em: string;
  atualizado_em: string;
}

export type EstoqueUnidadeInput = Pick<EstoqueUnidade, 'apelido' | 'avaria' | 'avaria_descricao' | 'fotos' | 'valor'>;

export interface Estoque {
  id: string;
  codigo: string;
  nome: string;
  categoria_id: string | null;
  categoria?: Categoria | null; // populado pelo backend via join, quando disponível
  modelo_moto_id: string | null;
  modelo_moto?: ModeloMoto | null;
  condicao: CondicaoPeca;
  // Estado físico da peça (1 = ruim, 10 = perfeita) — independente de
  // `condicao` acima, que é sobre origem (original/paralela), não estado.
  // null = não avaliada.
  condicao_nota: number | null;
  nota_cadastro: NotaCadastro | null;
  ano: string | null;
  valor: number;
  quantidade: number;
  // Fotos da peça, em ordem — a primeira é a capa mostrada nas listagens.
  imagens: string[];
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
  // Fichas de unidades físicas com avaria/observação (join do backend).
  // Ausente em payloads antigos em cache — sempre tratar como opcional.
  unidades?: EstoqueUnidade[];
  // Promoção vigente agora, já com o valor calculado — null quando não há
  // desconto ativo. Calculado pelo backend a cada consulta, ver
  // src/server/routes/estoque.ts > anexarPromocoes. Ausente em payloads
  // antigos em cache — sempre tratar como opcional/null.
  promocao_ativa?: PromocaoAtiva | null;
}

// Payload de criação/edição — o backend calcula id/codigo/timestamps.
export type EstoqueInput = Pick<
  Estoque,
  | 'nome'
  | 'categoria_id'
  | 'modelo_moto_id'
  | 'condicao'
  | 'condicao_nota'
  | 'nota_cadastro'
  | 'ano'
  | 'valor'
  | 'quantidade'
  | 'imagens'
  | 'descricao'
  | 'ativo'
  | 'componentes'
  | 'anuncio_ml_url'
  | 'anuncio_fb_url'
>;
