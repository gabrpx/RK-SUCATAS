import type { Categoria, ModeloMoto } from '../../types/catalog';
import type { PromocaoAtiva } from '../promocoes/types';
import type { EstatisticasAnuncioShopee } from '../shopee/types';

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
  // Preenchido quando esta ficha foi vendida como unidade específica (ver
  // migration_038/vendas.unidade_id) — soft marker, a ficha continua existindo
  // (com foto/avaria/preço) mesmo depois de vendida, só marcada indisponível.
  // Ausente/undefined em payloads antigos em cache — tratar como não vendida.
  vendida_em?: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type EstoqueUnidadeInput = Pick<EstoqueUnidade, 'apelido' | 'avaria' | 'avaria_descricao' | 'fotos' | 'valor' | 'condicao_nota'>;

// Snapshot de visitas/perguntas/vendas/saúde de um anúncio publicado pelo
// sistema — ver supabase/migration_043_mercadolivre_publicacao.sql. Escrito
// em background pelo scheduler (Fase 7) e lido junto com o link, pro modal
// de detalhes abrir instantâneo sem chamar o Mercado Livre na hora.
export interface EstatisticasAnuncioMl {
  link_id: string;
  visitas_total: number | null;
  visitas_ultimos_15_dias: number | null;
  perguntas_abertas: number;
  vendas_totais: number | null;
  saude_anuncio: number | null;
  status_ml: string | null;
  atualizado_em: string;
}

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
  // Campos novos da migration_043 — só existem pra anúncio criado PELO
  // SISTEMA (não só colado). Ausentes em payload antigo em cache ou em link
  // colado manualmente: tratar como undefined/false, nunca assumir presente.
  publicado_via_sistema?: boolean;
  ml_category_id?: string | null;
  listing_type_id?: string | null;
  condicao_ml?: 'new' | 'used' | null;
  status_ml?: string | null;
  publicado_em?: string | null;
  // Join do backend (Fase 7) — null quando ainda não teve a primeira
  // sincronização de estatísticas, undefined em payload antigo em cache.
  estatisticas?: EstatisticasAnuncioMl | null;
  criado_em: string;
  atualizado_em: string;
}

export type EstoqueAnuncioMlInput = Pick<EstoqueAnuncioMl, 'url'>;

// ============================================================================
// Publicação de anúncios NOVOS no Mercado Livre (migration_043) — tipos do
// formulário dinâmico gerado a partir da categoria escolhida. Espelham
// src/services/mercadolivrePublicacao.ts no backend.
// ============================================================================

// Categoria sugerida pelo preditor do Mercado Livre. Sem "confiança" em %: a
// API real só devolve a lista ORDENADA por probabilidade (primeiro = mais
// provável), não um score — não inventar um número que a API não dá.
export interface CategoriaMlSugerida {
  id: string;
  nome: string;
  caminho: string | null;
  atributosSugeridos: { id: string; valueId: string | null; valueName: string | null }[];
}

// Um atributo da categoria escolhida (GET /categories/{id}/attributes) — o
// formulário dinâmico renderiza 1 campo por atributo, o componente certo
// decidido por value_type (list = select com `values`, number/number_unit =
// input numérico, boolean = toggle, string = texto livre).
// Um nó da navegação manual em árvore de categoria (GET /categorias/filhos) —
// raiz do site ou filhos diretos de uma categoria. Lista vazia pro nó clicado
// = ele já é folha, pronto pra virar CategoriaMlSugerida.
export interface CategoriaMlNo {
  id: string;
  nome: string;
}

export interface AtributoMl {
  id: string;
  name: string;
  value_type: 'string' | 'number' | 'number_unit' | 'boolean' | 'list' | string;
  tags: Record<string, boolean>;
  values?: { id: string; name: string }[];
  attribute_group_name?: string;
}

// Um produto de catálogo do Mercado Livre encontrado na busca por título —
// ver GET /api/mercadolivre/produtos-catalogo. `foto` é null quando o
// produto não tem nenhuma imagem cadastrada no catálogo.
export interface ProdutoCatalogoMl {
  id: string;
  nome: string;
  foto: string | null;
}

export interface TipoAnuncioMl {
  id: string;
  nome: string;
  taxaVendaPercentual: number;
  // Espelha mercadolivrePublicacao.ts (backend) — os dois precisam ser
  // atualizados juntos, senão o campo some silenciosamente na fronteira JSON.
  taxaVendaValor: number;
  exposicao: string;
}

// Valor escolhido pelo usuário pra um atributo — o que o formulário dinâmico
// produz e o que POST /:id/publicar-ml espera em `atributos`/`variacoes[].atributos`.
export interface AtributoValorInput {
  id: string;
  value_id?: string;
  value_name?: string;
  value_struct?: { number: number; unit: string };
}

export interface VariacaoMlInput {
  unidade_id: string;
  atributos: AtributoValorInput[];
  // Preço efetivo do sistema (ANTES da margem) só desta ficha — ausente usa
  // estoque_unidades.valor automaticamente no backend.
  preco_efetivo_sistema?: number;
}

// Corpo de POST /:id/publicar-ml.
export interface ConfiguracaoAnuncioMlInput {
  categoria_ml_id: string;
  condicao_ml: 'new' | 'used';
  listing_type_id: string;
  atributos: AtributoValorInput[];
  fotos: string[];
  preco_efetivo_sistema?: number;
  variacoes?: VariacaoMlInput[];
  // Produto de catálogo escolhido na busca inline — ausente = publica sem
  // vínculo (fluxo "Não é o que eu vendo" ou categoria que não exige catálogo).
  catalogo_produto_id?: string;
  // Título e descrição PRÓPRIOS do anúncio — nunca o nome/descrição do
  // cadastro da peça. Obrigatórios: o formulário sempre pré-preenche, mas o
  // usuário precisa poder ajustar pra vender melhor.
  titulo_anuncio: string;
  descricao_anuncio: string;
}

export interface ResultadoPublicacaoMl {
  caminho: 'variacoes' | 'itens_separados' | 'simples';
  avisoFallback: string | null;
  /** null quando todas as fotos enviadas entraram no anúncio */
  avisoFotos: string | null;
  links: { linkId: string; mlbId: string; url: string }[];
}

// ============================================================================
// Publicação de anúncios na Shopee (migration_045) — segundo canal,
// companheiro do bloco do Mercado Livre acima. Espelham
// src/services/shopeePublicacao.ts no backend. Sem "legado" nem "caminho de
// fallback": a Shopee nasceu já com N anúncios por peça e sem o rollout
// gradual de preço por variação que o Mercado Livre teve — ver
// docs/proposta-publicacao-shopee.md.
// ============================================================================

// Um anúncio da Shopee vinculado a esta peça — ver
// supabase/migration_045_shopee_publicacao.sql.
export interface EstoqueAnuncioShopee {
  id: string;
  estoque_id: string;
  shop_id: string;
  item_id: string;
  url: string | null;
  category_id: string | null;
  status_shopee: string | null;
  atributos_shopee: Record<string, any> | null;
  publicado_em: string | null;
  // Join do backend (Fase 7) — null quando ainda não teve a primeira
  // sincronização de estatísticas, undefined em payload antigo em cache.
  estatisticas?: EstatisticasAnuncioShopee | null;
  criado_em: string;
  atualizado_em: string;
}

export interface VariacaoShopeeInput {
  unidade_id: string;
  // Preço efetivo do sistema (ANTES da margem) só desta ficha — ausente usa
  // estoque_unidades.valor automaticamente no backend.
  preco_efetivo_sistema?: number;
}

// Corpo de POST /:id/publicar-shopee.
export interface ConfiguracaoAnuncioShopeeInput {
  categoria_shopee_id: number;
  logistics_channel_id: number;
  atributos: { attribute_id: number; attribute_value_list: { value_id?: number; original_value_name?: string }[] }[];
  // Peso em kg — campo obrigatório no add_item da Shopee, sem coluna
  // equivalente no cadastro de estoque (a peça não tem peso salvo).
  peso_kg: number;
  preco_efetivo_sistema?: number;
  variacoes?: VariacaoShopeeInput[];
  titulo_anuncio: string;
  descricao_anuncio: string;
}

export interface ResultadoPublicacaoShopee {
  linkId: string;
  itemId: string;
  usaVariacoes: boolean;
  /** null quando todas as fotos enviadas entraram no anúncio */
  avisoFotos: string | null;
}

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
  // Anúncios da Shopee vinculados a esta peça (join do backend, Fase 7).
  // Ausente em payloads antigos em cache — sempre tratar como opcional.
  links_shopee?: EstoqueAnuncioShopee[];
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
