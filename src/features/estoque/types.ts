import type { Categoria, ModeloMoto } from '../../types/catalog';
import type { PromocaoAtiva } from '../promocoes/types';

// Peça original (retirada de moto sucateada na loja) vs paralela (compatível de terceiros).
export type CondicaoPeca = 'original' | 'paralela';

// Só se aplica (e é obrigatório) pra peças na categoria Motor ou subcategorias
// dela — ver src/features/estoque/categoriaMotor.ts.
export type NotaCadastro = 'com_nota' | 'sem_nota';

// Ficha de uma unidade física específica dentro da mesma linha de estoque —
// ver supabase/migration_014_unidades_avaria.sql. Só existe pra unidade que
// tem algo diferente das outras (5 TBI iguais, 1 amassado = 1 ficha só; mas
// "diferente" nem sempre é avaria — pode ser só uma nota de condição própria,
// um apelido ou um preço diferente, numa unidade sem defeito nenhum).
export interface EstoqueUnidade {
  id: string;
  estoque_id: string;
  /** Como a loja chama essa unidade: "A amassada", "Sem bico injetor" */
  apelido: string | null;
  avaria: boolean;
  avaria_descricao: string | null;
  /** Fotos desta unidade — separadas de estoque.imagens, que mostra a peça boa */
  fotos: string[];
  /** null = vale o preço normal da peça; preenchido = preço só desta unidade */
  valor: number | null;
  // Nota de condição (1-10) desta unidade específica — mesma escala e mesma
  // semântica de herança que `valor` acima: null = herda estoque.condicao_nota;
  // preenchido = essa unidade tem nota própria, sobrepondo a da peça.
  // Pode vir ausente (undefined) em vez de null se o backend ainda não achou
  // a coluna em produção (migration_024 pendente) — tratar undefined igual a null.
  condicao_nota: number | null;
  criado_em: string;
  atualizado_em: string;
}

export type EstoqueUnidadeInput = Pick<EstoqueUnidade, 'apelido' | 'avaria' | 'avaria_descricao' | 'fotos' | 'valor' | 'condicao_nota'>;

// Um anúncio do Mercado Livre vinculado a esta peça — ver
// supabase/migration_025_estoque_anuncios_ml.sql. Substitui o campo único
// `anuncio_ml_url` (no máximo 1 por peça) por N vínculos, cada um
// sincronizável com seu próprio anúncio no ML.
export interface EstoqueAnuncioMl {
  id: string;
  estoque_id: string;
  url: string;
  mlb_id: string;
  // true = este vínculo ainda vive só na coluna legada anuncio_ml_url
  // (migration_025 não rodou em produção ainda) — `id` nesse caso não é um
  // uuid de verdade, é `legado:${estoque_id}`, tratado à parte pelo backend.
  legado?: boolean;
  criado_em: string;
  atualizado_em: string;
}

export type EstoqueAnuncioMlInput = Pick<EstoqueAnuncioMl, 'url'>;

export interface Estoque {
  id: string;
  codigo: string;
  nome: string;
  categoria_id: string | null;
  categoria?: Categoria | null; // populado pelo backend via join, quando disponível
  modelo_moto_id: string | null;
  modelo_moto?: ModeloMoto | null;
  // Modelos SECUNDÁRIOS (além do principal acima) em que a mesma peça física
  // também serve — ex: lanterna que serve na CG 150 e na CG 125 Fan. Populado
  // pelo backend via join em estoque_modelos_compativeis (migration_019).
  // Ausente em payloads antigos em cache — sempre tratar como opcional.
  modelos_compativeis?: ModeloMoto[];
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
  // Legado (migration_008) — não é mais editável a partir da migration_025,
  // que substituiu isso por `links_ml` (N anúncios por peça). Continua
  // presente no retorno da API só pelos dados antigos que já tinha; usar
  // `links_ml` pra tudo daqui pra frente.
  anuncio_ml_url: string | null;
  // Link do anúncio publicado no Facebook Marketplace — null quando a peça
  // ainda não foi anunciada lá. Continua sendo 1 link só, fora do escopo da
  // migration_025 (que mexeu só no Mercado Livre).
  anuncio_fb_url: string | null;
  // Anúncios do Mercado Livre vinculados a esta peça (join do backend, ver
  // anexarAnunciosMl em src/server/routes/estoque.ts). Ausente em payloads
  // antigos em cache — sempre tratar como opcional.
  links_ml?: EstoqueAnuncioMl[];
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
  | 'anuncio_fb_url'
> & {
  // Ids dos modelos secundários — não é campo direto de `Estoque` (que expõe
  // os objetos já resolvidos em `modelos_compativeis`), é derivado na leitura
  // e enviado como lista de ids na escrita.
  modelo_moto_compativel_ids: string[];
};
