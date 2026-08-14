// Orquestração da publicação de anúncios NOVOS no Mercado Livre — companheiro
// de mercadolivreSync.ts, mesma separação de responsabilidade: aqui cruza o
// catálogo (estoque/estoque_unidades) com o cliente puro de
// mercadolivreApi.ts. mercadolivreSync.ts cuida de anúncios que já existem
// (sincronizar preço/estoque, importar pedido); este arquivo cuida de criar
// o anúncio em si (migration_043).
//
// Site fixo em MLB: esta integração é sempre doméstica (Brasil, OAuth
// simples), nunca o programa de Global Selling/CBT — que usa outro modelo de
// variação (User Products/family_id) fora do escopo daqui. Ver Parte 1.4 da
// proposta de publicação (docs/proposta-publicacao-mercadolivre.md).
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  obterMargemSincronizacao,
  obterConexaoAtual,
  predizerCategoria,
  buscarAtributosCategoriaML,
  buscarCategoriaML,
  buscarCategoriasRaizML,
  buscarTiposAnuncioML,
  buscarProdutosCatalogoML,
  criarItemML,
  atualizarDescricaoML,
  buscarItensPorIds,
  buscarVisitasItem,
  buscarVisitasUltimosDias,
  buscarPerguntas,
  type AtributoCategoriaML,
} from './mercadolivreApi.js';

const CODIGOS_MIGRATION_AUSENTE = ['42703', '42P01', 'PGRST205'];

function ehErroDeMigrationAusente(error: any): boolean {
  return !!error && CODIGOS_MIGRATION_AUSENTE.includes(error.code);
}

function arredondarCentavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

// ============================================================================
// Categoria — preditor + atributos com cache local (mercadolivre_categorias_cache)
// ============================================================================

export interface CategoriaMlSugerida {
  id: string;
  nome: string;
  caminho: string | null;
  atributosSugeridos: { id: string; valueId: string | null; valueName: string | null }[];
}

// Lista ordenada por probabilidade (primeiro = mais provável, conforme a
// documentação do preditor) — a UI decide quantas mostrar e deixa o usuário
// trocar por busca manual.
export async function sugerirCategoria(token: string, titulo: string): Promise<CategoriaMlSugerida[]> {
  const predicoes = await predizerCategoria(token, titulo);
  return predicoes.map((p) => ({
    id: p.category_id,
    nome: p.category_name,
    caminho: p.domain_name ?? null,
    atributosSugeridos: p.attributes.map((a) => ({ id: a.id, valueId: a.value_id, valueName: a.value_name })),
  }));
}

// Navegação manual em árvore — segunda forma de achar a categoria certa
// quando o preditor erra o domínio (ex: "Lanterna traseira CB 300R" caindo em
// "Motos transacionais" em vez de "Peças de Motos e Quadriciclos"). Sem
// categoriaId = raiz do site; com categoriaId = filhos diretos dela (vazio =
// categoria já é folha). Não cacheia em tabela — leitura direta e barata da
// API a cada clique, cache de nível já visitado fica em estado do componente.
export async function listarFilhosCategoria(token: string, categoriaId?: string): Promise<{ id: string; nome: string }[]> {
  if (!categoriaId) {
    const raiz = await buscarCategoriasRaizML(token);
    return raiz.map((c) => ({ id: c.id, nome: c.name }));
  }
  const categoria = await buscarCategoriaML(token, categoriaId);
  return (categoria.children_categories ?? []).map((c) => ({ id: c.id, nome: c.name }));
}

// Padronizar categoria (Fase 4): categorias.mercadolivre_categoria_id_padrao
// só guarda o id — pra pré-selecionar essa categoria ao abrir o modal (em
// vez de rebuscar por nome/navegar de novo), o formulário precisa também de
// nome/caminho pra exibir. Mesmo shape de CategoriaMlSugerida usado pelo
// preditor, pra reaproveitar o resto do formulário sem mudança nenhuma.
export async function buscarDetalheCategoria(token: string, categoriaId: string): Promise<CategoriaMlSugerida> {
  const categoria = await buscarCategoriaML(token, categoriaId);
  return {
    id: categoria.id,
    nome: categoria.name,
    caminho: categoria.path_from_root.length > 0 ? categoria.path_from_root.map((c) => c.name).join(' > ') : null,
    atributosSugeridos: [],
  };
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Categoria e atributos mudam raramente — olha mercadolivre_categorias_cache
// primeiro, só bate na API do ML se ausente ou vencido (>7 dias). Se a
// migration_043 ainda não rodou (tabela ausente), simplesmente não cacheia —
// a busca continua funcionando, só sem o atalho.
export async function buscarAtributosCategoriaComCache(supabase: SupabaseClient, token: string, categoriaId: string): Promise<AtributoCategoriaML[]> {
  const { data: cache, error } = await supabase.from('mercadolivre_categorias_cache').select('*').eq('categoria_ml_id', categoriaId).maybeSingle();
  if (error && !ehErroDeMigrationAusente(error)) throw error;

  const vencido = !!cache && Date.now() - new Date(cache.atualizado_em).getTime() > CACHE_TTL_MS;
  if (cache && !vencido) return cache.atributos as AtributoCategoriaML[];

  const [atributos, categoria] = await Promise.all([buscarAtributosCategoriaML(token, categoriaId), buscarCategoriaML(token, categoriaId)]);

  const { error: erroCache } = await supabase.from('mercadolivre_categorias_cache').upsert(
    {
      categoria_ml_id: categoriaId,
      nome_ml: categoria.name,
      caminho: categoria.path_from_root.map((c) => c.name).join(' > '),
      atributos,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'categoria_ml_id' }
  );
  // Falha ao gravar cache não deve impedir o formulário de abrir — só significa
  // que a próxima consulta bate na API de novo.
  if (erroCache && !ehErroDeMigrationAusente(erroCache)) console.error('Erro ao gravar cache de categoria do Mercado Livre:', erroCache);

  return atributos;
}

export interface ProdutoCatalogoMl {
  id: string;
  nome: string;
  foto: string | null;
}

// "Reconhecer produtos" antes de publicar — busca por título, mesma
// experiência do site oficial do ML (não filtra por categoria: o próprio
// listing_strategy=catalog_required já restringe a busca ao que interessa).
export async function buscarProdutosCatalogo(token: string, titulo: string): Promise<ProdutoCatalogoMl[]> {
  const produtos = await buscarProdutosCatalogoML(token, titulo);
  return produtos.map((p) => ({ id: p.id, nome: p.name, foto: p.pictures?.[0]?.url ?? null }));
}

// ============================================================================
// Tipos de anúncio disponíveis pro preço informado
// ============================================================================

export interface TipoAnuncioMl {
  id: string;
  nome: string;
  taxaVendaPercentual: number;
  // Valor cru da comissão em R$ (sale_fee_amount) — o site oficial mostra
  // isso, não o percentual, como elemento mais forte do card de tipo de
  // anúncio (Parte 3.3 da proposta / CLAUDE.md: número > label).
  taxaVendaValor: number;
  // listing_exposure cru da API (ex: "highest") — os textos de marketing dos
  // cards (Exposição alta/máxima) vêm de um dicionário fixo por
  // listing_type_id em EstoquePublicarMlModal.tsx, não deste campo; ele só
  // fica disponível pra quem precisar do dado bruto.
  exposicao: string;
}

export async function buscarTiposAnuncioDisponiveis(token: string, preco: number): Promise<TipoAnuncioMl[]> {
  const tipos = await buscarTiposAnuncioML(token, preco);
  // sale_fee_amount vem em R$ (valor da comissão pro preço consultado), não
  // uma fração — precisa dividir pelo preço pra virar percentual. Descoberto
  // testando com peça real: sem essa divisão a taxa aparecia como "3120%".
  return tipos.map((t) => ({
    id: t.listing_type_id,
    nome: t.listing_type_name,
    taxaVendaPercentual: preco > 0 ? (t.sale_fee_amount / preco) * 100 : 0,
    taxaVendaValor: t.sale_fee_amount,
    exposicao: t.listing_exposure,
  }));
}

// ============================================================================
// Erro — função pura, sem I/O
// ============================================================================

// O topo de error.response.data do Mercado Livre costuma trazer um `message`
// genérico e pouco acionável (ex: "body.required_fields" — só diz QUE algo no
// corpo está faltando, não O QUE). O detalhe de verdade (qual atributo, qual
// campo) vem em `cause[].message`. Sem isso, tanto o log do servidor quanto o
// aviso na tela ficavam cegos pro motivo real da recusa.
export function extrairMensagemErroMl(data: any): string | null {
  if (!data) return null;
  const causas = Array.isArray(data.cause)
    ? data.cause.map((c: any) => c?.message).filter((m: any): m is string => typeof m === 'string' && m.length > 0)
    : [];
  if (causas.length > 0) return causas.join('; ');
  return typeof data.message === 'string' && data.message.length > 0 ? data.message : null;
}

// ============================================================================
// Montagem do payload de publicação — função pura, sem I/O
// ============================================================================

export interface AtributoValorConfig {
  id: string;
  value_id?: string;
  value_name?: string;
  value_struct?: { number: number; unit: string };
}

export interface VariacaoConfig {
  unidadeId: string;
  // O que diferencia esta variação no Mercado Livre (ex: COLOR=Preta) —
  // decidido na UI a partir de buscarAtributosCategoriaComCache, nunca
  // derivado automaticamente do apelido em texto livre da ficha.
  atributos: AtributoValorConfig[];
  // Preço efetivo do sistema PRA ESTA VARIAÇÃO (mesmo conceito de
  // precoEfetivoSistema abaixo) — se ausente, usa estoque_unidades.valor; se
  // esse também for null, usa o preço efetivo da peça inteira.
  precoEfetivoSistema?: number;
}

export interface ConfiguracaoAnuncioMl {
  categoriaMlId: string;
  condicaoMl: 'new' | 'used';
  listingTypeId: string;
  atributos: AtributoValorConfig[];
  fotos: string[];
  // Preço efetivo do sistema pra esta peça (mesmo conceito de
  // precoEfetivoSistema em mercadolivreSync.ts: JÁ com promoção, ANTES da
  // margem) — se ausente, usa estoque.valor. NUNCA mande aqui um valor que já
  // inclua a margem: ela é aplicada uma única vez dentro desta função.
  precoEfetivoSistema?: number;
  // Presente = tentar publicar com variações reais (2+ fichas com atributo
  // escolhido); ausente/vazio = item simples.
  variacoes?: VariacaoConfig[];
  // Produto de catálogo escolhido na busca inline (categorias
  // catalog_required) — presente força item simples (o Mercado Livre não
  // aceita variations[] em anúncio catalog_listing:true), ver
  // montarPayloadPublicacao abaixo.
  catalogoProdutoId?: string;
  // Título e descrição PRÓPRIOS do anúncio (editáveis no modal) — nunca o
  // nome/descrição do cadastro da peça, que é otimizado pra busca no
  // catálogo interno, não pra converter comprador no Mercado Livre.
  // Opcionais no tipo de propósito: a rota HTTP sempre preenche os dois
  // (campo obrigatório no formulário), mas montarPayloadPublicacao é função
  // pura reaproveitada dentro do próprio publicarAnuncio (fallback de itens
  // separados por ficha) e testada isolada — sem eles, cai no fallback do
  // nome/descrição da peça (defesa em profundidade, mesmo padrão já usado
  // neste arquivo pro catalogoProdutoId acima).
  tituloAnuncio?: string;
  descricaoAnuncio?: string;
}

interface ItemParaPublicar {
  nome: string;
  valor: number;
  quantidade: number;
}

interface UnidadeParaPublicar {
  id: string;
  valor: number | null;
  fotos: string[];
}

interface PayloadPublicacao {
  payload: Record<string, any>;
  usaVariacoes: boolean;
  // Mesma ordem de payload.variations — usado depois pra casar a resposta do
  // ML (que devolve os ids atribuídos na mesma ordem) com a ficha de origem.
  ordemUnidades: string[];
}

function calcularPrecoComMargem(precoEfetivo: number, margemPercentual: number): number {
  return arredondarCentavos(precoEfetivo * (1 + margemPercentual / 100));
}

function mapearAtributo({ id, value_id, value_name, value_struct }: AtributoValorConfig) {
  return { id, value_id, value_name, value_struct };
}

// Decide entre item simples e item com variações[], e já aplica a margem de
// sincronização (mesma fórmula de mercadolivreSync.ts:
// precoNovoSistema = precoEfetivoSistema * (1 + margem/100)) — não existe um
// segundo cálculo de preço em lugar nenhum deste módulo.
export function montarPayloadPublicacao(
  item: ItemParaPublicar,
  unidades: UnidadeParaPublicar[],
  config: ConfiguracaoAnuncioMl,
  margemPercentual: number
): PayloadPublicacao {
  const precoEfetivoPeca = config.precoEfetivoSistema ?? item.valor;
  const unidadesPorId = new Map(unidades.map((u) => [u.id, u]));

  const base: Record<string, any> = {
    title: (config.tituloAnuncio || item.nome).slice(0, 60),
    category_id: config.categoriaMlId,
    currency_id: 'BRL',
    buying_mode: 'buy_it_now',
    condition: config.condicaoMl,
    listing_type_id: config.listingTypeId,
    attributes: config.atributos.map(mapearAtributo),
    // "me2" (Mercado Envios Fulfillment) exige contrato/elegibilidade que a
    // loja não tem e várias categorias de autopeças nem aceitam (confirmado
    // ao vivo em GET /categories/{id}: settings.shipping_options não inclui
    // "me2") — mandar esse modo faz o Mercado Livre recusar a criação do
    // item inteiro com "body.required_fields". "not_specified" ("a combinar")
    // é aceito por qualquer conta/categoria e já reflete o fluxo real: o
    // frete é calculado à parte, na venda, via Melhor Envio (ver
    // src/features/frete), nunca no ato da publicação do anúncio.
    shipping: { mode: 'not_specified' },
  };

  if (config.catalogoProdutoId) {
    base.catalog_product_id = config.catalogoProdutoId;
    base.catalog_listing = true;
  }

  // Menos de 2 fichas com atributo de variação escolhido não é variação de
  // verdade — vira item simples com o preço/estoque da peça inteira (mesmo
  // critério da Parte 3.2 da proposta: "2+ fichas com valor/apelido próprios").
  // Produto de catálogo escolhido = nunca variations[] (o Mercado Livre não
  // aceita variação em item catalog_listing:true — cada ficha viraria um
  // anúncio catálogo separado, fora de escopo). A UI já evita chegar aqui
  // com variações preenchidas; isto é defesa em profundidade.
  const variacoesValidas = config.catalogoProdutoId ? [] : (config.variacoes ?? []).filter((v) => v.atributos.length > 0 && unidadesPorId.has(v.unidadeId));
  if (variacoesValidas.length < 2) {
    return {
      usaVariacoes: false,
      ordemUnidades: [],
      payload: {
        ...base,
        price: calcularPrecoComMargem(precoEfetivoPeca, margemPercentual),
        available_quantity: item.quantidade,
        pictures: config.fotos.map((source) => ({ source })),
      },
    };
  }

  // Uma foto só precisa aparecer 1x na lista do item, mesmo reaproveitada em
  // mais de uma variação — picture_ids de cada variação referencia o MESMO
  // texto de source usado aqui (é assim que o Mercado Livre casa foto de
  // variação com a lista de fotos do item — ver "Substituir imagens" em
  // developers.mercadolivre.com.br/pt_br/trabalhar-com-imagens).
  const fotosDasVariacoes = variacoesValidas.flatMap((v) => unidadesPorId.get(v.unidadeId)!.fotos);
  const todasAsFotos = Array.from(new Set([...config.fotos, ...fotosDasVariacoes]));

  return {
    usaVariacoes: true,
    ordemUnidades: variacoesValidas.map((v) => v.unidadeId),
    payload: {
      ...base,
      pictures: todasAsFotos.map((source) => ({ source })),
      variations: variacoesValidas.map((v) => {
        const unidade = unidadesPorId.get(v.unidadeId)!;
        const precoEfetivoVariacao = v.precoEfetivoSistema ?? unidade.valor ?? precoEfetivoPeca;
        return {
          attribute_combinations: v.atributos.map(mapearAtributo),
          available_quantity: 1,
          price: calcularPrecoComMargem(precoEfetivoVariacao, margemPercentual),
          picture_ids: unidade.fotos.length > 0 ? unidade.fotos : config.fotos,
        };
      }),
    },
  };
}

// ============================================================================
// Publicação — orquestra o fluxo completo (Parte 3.4 da proposta)
// ============================================================================

// A API não documenta um código de erro estável pra "conta/categoria ainda
// sem Preço por Variação liberado" (rollout gradual — Parte 1.4 da proposta),
// então checamos por palavras-chave no corpo do erro. Heurística de
// propósito conservadora: se não bater, o erro original sobe sem fallback —
// melhor falhar visível do que aplicar o fallback errado silenciosamente.
// Vale revisar isto contra o erro real assim que a Fase 8 (teste com conta
// de verdade) rodar.
function pareceErroPrecoPorVariacao(error: any): boolean {
  const corpo = JSON.stringify(error?.response?.data ?? '').toLowerCase();
  return corpo.includes('variat') && (corpo.includes('price') || corpo.includes('precio') || corpo.includes('preco'));
}

// Mesmo raciocínio acima, pra outra frente do mesmo rollout: contas migradas
// pro modelo novo de User Products (Preço por Variação) passam a exigir,
// pra QUALQUER item sem catalog_product_id (com ou sem variações — ver
// "Publicar um item" em developers.mercadolivre.com.br/pt_br/preco-variacao),
// o campo novo family_name — que este módulo nunca mandava, porque não
// existia quando este código foi escrito. Detectado ao vivo publicando uma
// peça: "The body does not contains some or none of the following
// properties [family_name]". Exportada (não só interna como
// pareceErroPrecoPorVariacao) pra dar pra testar a heurística isolada.
export function pareceErroFamilyNameAusente(error: any): boolean {
  const mensagem = extrairMensagemErroMl(error?.response?.data) ?? '';
  return mensagem.toLowerCase().includes('family_name');
}

async function gravarResultadoPublicacao(
  supabase: SupabaseClient,
  token: string,
  estoqueId: string,
  config: ConfiguracaoAnuncioMl,
  criado: any,
  descricaoTexto: string,
  ordemUnidades: string[],
  origemUnidadeId?: string
): Promise<string> {
  // Passo à parte de propósito (a API não é transacional entre os dois): se
  // isso falhar, o anúncio já existe sem descrição e fica pra reexecutar
  // depois via republicar — não derruba a publicação em si.
  try {
    await atualizarDescricaoML(token, criado.id, descricaoTexto);
  } catch (err: any) {
    console.error(`Anúncio ${criado.id} publicado sem descrição (POST /items/${criado.id}/description falhou):`, err.response?.data || err.message);
  }

  const { data: link, error } = await supabase
    .from('estoque_anuncios_ml')
    .insert({
      estoque_id: estoqueId,
      url: criado.permalink,
      mlb_id: criado.id,
      publicado_via_sistema: true,
      ml_category_id: config.categoriaMlId,
      listing_type_id: config.listingTypeId,
      condicao_ml: config.condicaoMl,
      status_ml: criado.status ?? null,
      // Metadado leve só pro caso de fallback (anúncio separado por ficha) —
      // não é uma "variação" real do ML, mas registra de qual ficha ele veio.
      atributos_ml: origemUnidadeId
        ? { origem_unidade_id: origemUnidadeId }
        : config.catalogoProdutoId
          ? { catalog_product_id: config.catalogoProdutoId }
          : null,
      publicado_em: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;

  if (ordemUnidades.length > 0) {
    const variacoesResposta: any[] = criado.variations ?? [];
    const linhas = ordemUnidades
      .map((unidadeId, indice) => {
        const variacao = variacoesResposta[indice];
        return {
          link_id: link.id,
          unidade_id: unidadeId,
          ml_variation_id: variacao?.id != null ? String(variacao.id) : '',
          preco: variacao?.price ?? null,
          quantidade: variacao?.available_quantity ?? 1,
        };
      })
      .filter((linha) => linha.ml_variation_id);
    if (linhas.length > 0) {
      const { error: erroVariacoes } = await supabase.from('estoque_anuncios_ml_variacoes').insert(linhas);
      if (erroVariacoes && !ehErroDeMigrationAusente(erroVariacoes)) throw erroVariacoes;
    }
  }

  // Primeira leitura de estatísticas já no ato da publicação — não espera o
  // próximo ciclo do scheduler (Fase 7) pra existir algo quando o modal de
  // detalhes for reaberto. Best-effort: erro aqui não derruba a publicação.
  sincronizarEstatisticas(supabase, token, [link.id]).catch((err) => {
    console.error(`Erro ao buscar estatísticas iniciais do anúncio ${criado.id}:`, err.response?.data || err.message);
  });

  return link.id;
}

export interface ResultadoPublicacao {
  caminho: 'variacoes' | 'itens_separados' | 'simples';
  avisoFallback: string | null;
  /** null quando todas as fotos enviadas entraram no anúncio — ver detectarFotosNaoAnexadas */
  avisoFotos: string | null;
  links: { linkId: string; mlbId: string; url: string }[];
}

// POST /items manda `pictures: fotos.map(source => ({source}))` mas a
// resposta nunca era conferida: se o Mercado Livre falhar em baixar/processar
// uma foto específica (timeout, URL momentaneamente inacessível, etc.), o
// item é criado normalmente com menos fotos que o pedido — sem erro nenhum.
// Bug reportado: "mandei 2 fotos, só 1 entrou no anúncio", nenhum aviso na
// tela. Função pura pra dar pra testar isolada do I/O de criarItemML.
export function detectarFotosNaoAnexadas(fotosEnviadas: string[], criado: { pictures?: unknown[] }): string | null {
  const enviadas = fotosEnviadas.length;
  if (enviadas === 0) return null;
  const anexadas = criado.pictures?.length ?? 0;
  if (anexadas >= enviadas) return null;
  const faltando = enviadas - anexadas;
  return `${faltando} de ${enviadas} ${enviadas === 1 ? 'foto não entrou' : 'fotos não entraram'} no anúncio (o Mercado Livre pode ter rejeitado alguma sem avisar) — confira e tente adicionar de novo se precisar.`;
}

// No modelo de User Products, o Mercado Livre gera o title sozinho a partir
// de family_name + atributos — mandar os dois juntos é recusado com "The
// fields [title] are invalid for requested call." (confirmado ao vivo: ver
// developers.mercadolivre.com.br/pt_br/user-products, "title... received
// temporarily for backward compatibility", algumas contas recusam se vier
// preenchido). Função pura pra dar pra testar isolada do I/O de criarItemML.
export function montarPayloadComFamilyName(payload: Record<string, any>, nomeFamilia: string): Record<string, any> {
  const { title, ...resto } = payload;
  return { ...resto, family_name: nomeFamilia };
}

// Envolve criarItemML pra aplicar o fallback de pareceErroFamilyNameAusente
// acima: primeira tentativa como o payload veio montado; se a conta exigir
// family_name, reenvia SEM title (ver montarPayloadComFamilyName) com esse
// campo acrescentado. nomeFamilia deve ser o mesmo valor que foi pro title
// (payload.title, antes de ser removido) — nesse modelo o Mercado Livre GERA
// o título do anúncio a partir do family_name, então mandar item.nome aqui
// fazia o anúncio sair sempre com o nome do cadastro de estoque, mesmo com
// um título próprio configurado (bug reportado: título do anúncio ignorado).
// Não existe uma "família" de verdade aqui (cada peça publicada é o próprio
// produto, sem catálogo de variantes por trás) — é só o campo que a API usa
// como descritor/título nesse modelo.
async function criarItemMlComFallbackFamilyName(token: string, payload: Record<string, any>, nomeFamilia: string): Promise<any> {
  try {
    return await criarItemML(token, payload);
  } catch (err: any) {
    if (!pareceErroFamilyNameAusente(err)) throw err;
    console.warn('Mercado Livre exigiu family_name (conta migrada pro modelo de User Products/Preço por Variação) — reenviando sem title, com family_name preenchido.', err.response?.data || err.message);
    return criarItemML(token, montarPayloadComFamilyName(payload, nomeFamilia));
  }
}

export async function publicarAnuncio(supabase: SupabaseClient, token: string, estoqueId: string, config: ConfiguracaoAnuncioMl): Promise<ResultadoPublicacao> {
  const { data: item, error: erroItem } = await supabase.from('estoque').select('id, nome, valor, quantidade, descricao').eq('id', estoqueId).maybeSingle();
  if (erroItem) throw erroItem;
  if (!item) throw new Error('Peça não encontrada.');

  const unidadeIds = (config.variacoes ?? []).map((v) => v.unidadeId);
  let unidades: UnidadeParaPublicar[] = [];
  if (unidadeIds.length > 0) {
    const { data, error } = await supabase.from('estoque_unidades').select('id, valor, fotos').in('id', unidadeIds);
    if (error) throw error;
    unidades = (data ?? []).map((u: any) => ({ id: u.id, valor: u.valor != null ? Number(u.valor) : null, fotos: u.fotos ?? [] }));
  }

  const margemPercentual = await obterMargemSincronizacao(supabase);
  // Mesma defesa em profundidade do título acima: descricaoAnuncio vem
  // sempre preenchida pela rota HTTP, o fallback é só pra chamada direta
  // desta função (sem passar pelo formulário obrigatório do modal).
  const descricaoTexto = config.descricaoAnuncio?.trim() || (item.descricao || '').trim() || item.nome;
  const montado = montarPayloadPublicacao(item, unidades, config, margemPercentual);

  // Tentativa 1: como veio montado (com variações, se a peça tem fichas
  // diferenciadas escolhidas no formulário).
  try {
    const criado = await criarItemMlComFallbackFamilyName(token, montado.payload, montado.payload.title);
    await gravarResultadoPublicacao(supabase, token, estoqueId, config, criado, descricaoTexto, montado.usaVariacoes ? montado.ordemUnidades : []);
    return {
      caminho: montado.usaVariacoes ? 'variacoes' : 'simples',
      avisoFallback: null,
      avisoFotos: detectarFotosNaoAnexadas(montado.payload.pictures.map((p: { source: string }) => p.source), criado),
      links: [{ linkId: criado.id, mlbId: criado.id, url: criado.permalink }],
    };
  } catch (err: any) {
    if (!montado.usaVariacoes || !pareceErroPrecoPorVariacao(err)) throw err;
    console.warn('Preço por variação recusado pelo Mercado Livre — publicando em anúncios separados por ficha.', err.response?.data || err.message);
  }

  // Fallback: item simples com o preço BASE da peça + 1 anúncio adicional
  // por ficha com valor próprio (mesma lógica de item simples, uma chamada
  // por ficha) — estoque_anuncios_ml já suporta N anúncios por peça
  // (migration_025), então todos ficam vinculados à mesma peça.
  const configSemVariacoes: ConfiguracaoAnuncioMl = { ...config, variacoes: undefined };
  const payloadBase = montarPayloadPublicacao(item, [], configSemVariacoes, margemPercentual);
  const criadoBase = await criarItemMlComFallbackFamilyName(token, payloadBase.payload, payloadBase.payload.title);
  await gravarResultadoPublicacao(supabase, token, estoqueId, config, criadoBase, descricaoTexto, []);
  const links = [{ linkId: criadoBase.id, mlbId: criadoBase.id, url: criadoBase.permalink }];
  const avisosFotos: string[] = [];
  const avisoFotosBase = detectarFotosNaoAnexadas(payloadBase.payload.pictures.map((p: { source: string }) => p.source), criadoBase);
  if (avisoFotosBase) avisosFotos.push(avisoFotosBase);

  for (const unidade of unidades) {
    if (unidade.valor == null) continue; // sem preço próprio não tem por que virar anúncio à parte
    const configUnidade: ConfiguracaoAnuncioMl = {
      ...config,
      precoEfetivoSistema: unidade.valor,
      fotos: unidade.fotos.length > 0 ? unidade.fotos : config.fotos,
      variacoes: undefined,
    };
    const payloadUnidade = montarPayloadPublicacao(item, [], configUnidade, margemPercentual);
    const criadoUnidade = await criarItemMlComFallbackFamilyName(token, payloadUnidade.payload, payloadUnidade.payload.title);
    await gravarResultadoPublicacao(supabase, token, estoqueId, config, criadoUnidade, descricaoTexto, [], unidade.id);
    links.push({ linkId: criadoUnidade.id, mlbId: criadoUnidade.id, url: criadoUnidade.permalink });
    const avisoFotosUnidade = detectarFotosNaoAnexadas(payloadUnidade.payload.pictures.map((p: { source: string }) => p.source), criadoUnidade);
    if (avisoFotosUnidade) avisosFotos.push(avisoFotosUnidade);
  }

  return {
    caminho: 'itens_separados',
    avisoFallback: 'O Mercado Livre ainda não libera preço diferente por variação pra esta conta/categoria — foi publicado 1 anúncio por ficha em vez de um anúncio só com variações.',
    avisoFotos: avisosFotos.length > 0 ? avisosFotos.join(' ') : null,
    links,
  };
}

// ============================================================================
// Estatísticas (Fase 7) — snapshot lido pelo modal de detalhes, escrito por
// aqui (chamado no ato da publicação e pelo scheduler em background)
// ============================================================================

export async function sincronizarEstatisticas(supabase: SupabaseClient, token: string, linkIds: string[]): Promise<void> {
  if (linkIds.length === 0) return;

  const { data: links, error } = await supabase.from('estoque_anuncios_ml').select('id, mlb_id').in('id', linkIds);
  if (error) {
    if (ehErroDeMigrationAusente(error)) return;
    throw error;
  }
  if (!links || links.length === 0) return;

  const mlbIds = links.map((l: any) => l.mlb_id);
  const conexao = await obterConexaoAtual(supabase);

  const [itensMl, visitasTotais, perguntas] = await Promise.all([
    buscarItensPorIds(token, mlbIds),
    buscarVisitasItem(token, mlbIds),
    conexao ? buscarPerguntas(token, conexao.mlUserId, 'UNANSWERED').catch(() => []) : Promise.resolve([]),
  ]);
  const mapaItens = new Map(itensMl.map((item: any) => [item.id, item]));
  const perguntasPorItem = new Map<string, number>();
  for (const p of perguntas) perguntasPorItem.set(p.item_id, (perguntasPorItem.get(p.item_id) ?? 0) + 1);

  // Visitas dos últimos 15 dias exige 1 chamada por item (a API não tem
  // versão em lote pra time_window) — aceitável porque isso roda em
  // background a cada 15-30min (Fase 7), não no clique do usuário.
  const linhas = await Promise.all(
    links.map(async (link: any) => {
      const itemMl = mapaItens.get(link.mlb_id);
      const visitasUltimos15 = await buscarVisitasUltimosDias(token, link.mlb_id, 15).catch(() => null);
      return {
        link_id: link.id,
        visitas_total: visitasTotais[link.mlb_id] ?? null,
        visitas_ultimos_15_dias: visitasUltimos15,
        perguntas_abertas: perguntasPorItem.get(link.mlb_id) ?? 0,
        vendas_totais: itemMl?.sold_quantity ?? null,
        // health vem 0-1 (ou null, pra categorias sem esse indicador) — guardamos
        // em % (0-100) pra bater com o numeric(5,2) de saude_anuncio.
        saude_anuncio: itemMl?.health != null ? Number(itemMl.health) * 100 : null,
        status_ml: itemMl?.status ?? null,
        atualizado_em: new Date().toISOString(),
      };
    })
  );

  const { error: erroUpsert } = await supabase.from('estoque_anuncios_ml_estatisticas').upsert(linhas, { onConflict: 'link_id' });
  if (erroUpsert && !ehErroDeMigrationAusente(erroUpsert)) throw erroUpsert;
}
