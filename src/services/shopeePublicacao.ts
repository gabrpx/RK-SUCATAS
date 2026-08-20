// Orquestração da publicação de anúncios na Shopee — companheiro de
// src/services/mercadolivrePublicacao.ts, mesma separação de
// responsabilidade: aqui cruza o catálogo (estoque/estoque_unidades) com o
// cliente puro de shopeeApi.ts. Nenhum arquivo do Mercado Livre é importado
// ou alterado aqui — arquivos-espelho paralelos, de propósito.
import type { SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';
import {
  obterMargemSincronizacaoShopee,
  buscarAtributosCategoriaShopee,
  buscarCategoriaShopee,
  buscarCanaisLogisticaShopee,
  uploadImagemShopee,
  criarItemShopee,
  inicializarVariacoesShopee,
  atualizarPrecoItemShopee,
  atualizarEstoqueItemShopee,
  buscarEstatisticasItemShopee,
  type AtributoCategoriaShopee,
  type CanalLogisticaShopee,
} from './shopeeApi.js';

const CODIGOS_MIGRATION_AUSENTE = ['42703', '42P01', 'PGRST205', 'PGRST204'];

function ehErroDeMigrationAusente(error: any): boolean {
  return !!error && CODIGOS_MIGRATION_AUSENTE.includes(error.code);
}

function arredondarCentavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function calcularPrecoComMargem(precoEfetivo: number, margemPercentual: number): number {
  return arredondarCentavos(precoEfetivo * (1 + margemPercentual / 100));
}

// ============================================================================
// Categoria e atributos — cache local (shopee_categorias_cache)
// ============================================================================

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Categoria e atributos mudam raramente — olha shopee_categorias_cache
// primeiro, só bate na API da Shopee se ausente ou vencido (>7 dias). Mesmo
// TTL de buscarAtributosCategoriaComCache do Mercado Livre. Se a
// migration_045 ainda não rodou (tabela ausente), simplesmente não cacheia —
// a busca continua funcionando, só sem o atalho.
//
// `caminho` guarda só o nome da própria categoria (não um breadcrumb
// completo até a raiz) — diferente do Mercado Livre, cuja API devolve
// path_from_root pronto; a da Shopee devolve a árvore achatada (ver
// shopeeApi.ts) e montar o caminho completo exigiria caminhar pais acima
// repetidamente, sem necessidade real pro que o formulário mostra hoje.
export async function buscarAtributosCategoriaComCache(supabase: SupabaseClient, accessToken: string, shopId: string, categoriaId: number): Promise<AtributoCategoriaShopee[]> {
  const chave = String(categoriaId);
  const { data: cache, error } = await supabase.from('shopee_categorias_cache').select('*').eq('categoria_shopee_id', chave).maybeSingle();
  if (error && !ehErroDeMigrationAusente(error)) throw error;

  const vencido = !!cache && Date.now() - new Date(cache.atualizado_em).getTime() > CACHE_TTL_MS;
  if (cache && !vencido) return cache.atributos as AtributoCategoriaShopee[];

  const [atributos, detalheCategoria] = await Promise.all([buscarAtributosCategoriaShopee(accessToken, shopId, categoriaId), buscarCategoriaShopee(accessToken, shopId, categoriaId)]);

  const { error: erroCache } = await supabase.from('shopee_categorias_cache').upsert(
    {
      categoria_shopee_id: chave,
      nome_shopee: detalheCategoria.categoria?.categoryName ?? chave,
      caminho: detalheCategoria.categoria?.categoryName ?? null,
      atributos,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'categoria_shopee_id' }
  );
  // Falha ao gravar cache não deve impedir o formulário de abrir — só
  // significa que a próxima consulta bate na API de novo.
  if (erroCache && !ehErroDeMigrationAusente(erroCache)) console.error('Erro ao gravar cache de categoria da Shopee:', erroCache);

  return atributos;
}

// ============================================================================
// Canal de logística — obrigatório na Shopee, sem equivalente "not_specified"
// como no Mercado Livre (Parte 1.2 da proposta)
// ============================================================================

export interface CanalLogisticaSugestao {
  canais: CanalLogisticaShopee[];
  // Pré-selecionado quando só existe 1 canal habilitado — o formulário ainda
  // deixa trocar se houver mais de um.
  sugerido: CanalLogisticaShopee | null;
}

export async function buscarCanalLogisticaPadrao(accessToken: string, shopId: string): Promise<CanalLogisticaSugestao> {
  const canais = (await buscarCanaisLogisticaShopee(accessToken, shopId)).filter((c) => c.enabled);
  return { canais, sugerido: canais.length === 1 ? canais[0] : null };
}

// ============================================================================
// Montagem do payload de publicação — função pura, sem I/O
// ============================================================================

export interface VariacaoConfigShopee {
  unidadeId: string;
  // Preço efetivo do sistema PRA ESTA VARIAÇÃO — se ausente, usa
  // estoque_unidades.valor; se esse também for null, usa o preço efetivo da
  // peça inteira. Mesmo conceito de VariacaoConfig.precoEfetivoSistema do ML.
  precoEfetivoSistema?: number;
}

// attribute_id + attribute_value_list no formato bruto da API da Shopee
// (mesmo espírito de AtributoValorConfig do ML: repassado cru pro payload,
// montado pela UI a partir de buscarAtributosCategoriaComCache).
export interface AtributoValorConfigShopee {
  attribute_id: number;
  attribute_value_list: { value_id?: number; original_value_name?: string }[];
}

export interface ConfiguracaoAnuncioShopee {
  categoriaShopeeId: number;
  logisticsChannelId: number;
  atributos: AtributoValorConfigShopee[];
  // Peso em kg — campo obrigatório no add_item da Shopee (Parte 1.2 da
  // proposta) sem equivalente na tabela `estoque`, que não tem coluna de
  // peso. Preenchido no formulário de publicação a cada peça, não persistido
  // no cadastro.
  pesoKg: number;
  // Preço efetivo do sistema pra esta peça (já com promoção, ANTES da
  // margem) — se ausente, usa estoque.valor. Mesma semântica de
  // ConfiguracaoAnuncioMl.precoEfetivoSistema.
  precoEfetivoSistema?: number;
  // Presente = tentar publicar com variações reais (2+ fichas); ausente/
  // vazio = item simples.
  variacoes?: VariacaoConfigShopee[];
  // Título e descrição PRÓPRIOS do anúncio — mesmo raciocínio do Mercado
  // Livre: nunca o nome/descrição do cadastro interno direto, que é
  // otimizado pra busca no catálogo interno, não pra converter comprador na
  // Shopee. Opcionais no tipo (defesa em profundidade pra chamada direta
  // desta função fora do formulário) — a rota HTTP sempre preenche os dois.
  tituloAnuncio?: string;
  descricaoAnuncio?: string;
}

interface ItemParaPublicarShopee {
  nome: string;
  valor: number;
  quantidade: number;
  descricao: string | null;
}

interface UnidadeParaPublicarShopee {
  id: string;
  apelido: string | null;
  valor: number | null;
}

export interface PayloadPublicacaoShopee {
  payloadItem: Record<string, any>;
  usaVariacoes: boolean;
  // Só presentes quando usaVariacoes — payload de init_tier_variation
  // (chamada separada, ver shopeeApi.ts::inicializarVariacoesShopee).
  tierVariation?: { name: string; option_list: { option: string }[] }[];
  modelList?: { tier_index: number[]; normal_stock: number; original_price: number }[];
  // Mesma ordem de modelList — usado depois pra casar a resposta da Shopee
  // (que devolve os model_id atribuídos na mesma ordem) com a ficha de
  // origem, mesmo papel de ordemUnidades no Mercado Livre.
  ordemUnidades: string[];
}

// Decide entre item simples e item com tier_variation, e já aplica a margem
// de sincronização própria da Shopee (shopee_conexao.margem_sincronizacao_
// percentual, nunca a do Mercado Livre). `imageIds` já vem resolvido (upload
// acontece em uploadFotosParaShopee, função com I/O, fora desta função pura)
// — mesmo raciocínio de picture_ids no Mercado Livre, mas aqui é obrigatório
// porque a Shopee não aceita URL por referência (Parte 1.5 da proposta).
export function montarPayloadPublicacaoShopee(
  item: ItemParaPublicarShopee,
  unidades: UnidadeParaPublicarShopee[],
  config: ConfiguracaoAnuncioShopee,
  imageIds: string[],
  margemPercentual: number
): PayloadPublicacaoShopee {
  const precoEfetivoPeca = config.precoEfetivoSistema ?? item.valor;
  const unidadesPorId = new Map(unidades.map((u) => [u.id, u]));

  const payloadItem: Record<string, any> = {
    item_name: (config.tituloAnuncio || item.nome).slice(0, 120),
    description: (config.descricaoAnuncio || item.descricao || item.nome).slice(0, 3000),
    category_id: config.categoriaShopeeId,
    weight: config.pesoKg,
    // NÃO CONFIRMADO NO SANDBOX (ver comentário de inicializarVariacoesShopee
    // em shopeeApi.ts pro mesmo tipo de ressalva): logistics_info é o formato
    // mais citado pra API v2 da Shopee, mas não foi testado contra a API
    // real por este agente.
    logistics_info: [{ logistic_id: config.logisticsChannelId, enabled: true }],
    image: { image_id_list: imageIds },
    attribute_list: config.atributos,
  };

  // Mesmo critério do Mercado Livre (montarPayloadPublicacao): menos de 2
  // fichas com valor próprio não é variação de verdade — vira item simples
  // com o preço/estoque da peça inteira.
  const variacoesValidas = (config.variacoes ?? []).filter((v) => unidadesPorId.has(v.unidadeId));
  if (variacoesValidas.length < 2) {
    return {
      usaVariacoes: false,
      ordemUnidades: [],
      payloadItem: { ...payloadItem, original_price: calcularPrecoComMargem(precoEfetivoPeca, margemPercentual), normal_stock: item.quantidade },
    };
  }

  // A Shopee representa a variação como um único "tier" nomeado, com uma
  // opção de texto livre por ficha (o apelido da ficha, ex: "Sem bico") — não
  // existe atributo estruturado equivalente a COLOR/SIZE pro caso de uma
  // sucata, então o tier nasce sempre com o nome genérico "Unidade".
  const opcoes = variacoesValidas.map((v, indice) => unidadesPorId.get(v.unidadeId)!.apelido?.trim() || `Unidade ${indice + 1}`);

  return {
    usaVariacoes: true,
    ordemUnidades: variacoesValidas.map((v) => v.unidadeId),
    payloadItem,
    tierVariation: [{ name: 'Unidade', option_list: opcoes.map((option) => ({ option })) }],
    modelList: variacoesValidas.map((v, indice) => {
      const unidade = unidadesPorId.get(v.unidadeId)!;
      const precoEfetivoVariacao = v.precoEfetivoSistema ?? unidade.valor ?? precoEfetivoPeca;
      return { tier_index: [indice], normal_stock: 1, original_price: calcularPrecoComMargem(precoEfetivoVariacao, margemPercentual) };
    }),
  };
}

// ============================================================================
// Fotos — upload binário prévio (Parte 1.5 da proposta)
// ============================================================================

export interface ResultadoUploadFotosShopee {
  imageIds: string[];
  // URLs que falharam no download do Storage ou no upload pra Shopee — quem
  // chama decide como avisar o usuário, publicação não é interrompida por
  // causa de UMA foto (a menos que TODAS falhem, ver publicarAnuncioShopee).
  falhas: string[];
}

// Baixa cada foto do Supabase Storage (estoque.imagens / estoque_unidades.
// fotos já são URLs públicas prontas) e re-sobe pra Shopee via
// uploadImagemShopee. Sequencial de propósito (não Promise.all): mesma
// cautela pragmática de dividirEmLotes em mercadolivreApi.ts — evita disparar
// N uploads simultâneos contra o rate limit da Shopee e isola qual foto
// especificamente falhou.
export async function uploadFotosParaShopee(accessToken: string, shopId: string, urls: string[]): Promise<ResultadoUploadFotosShopee> {
  const imageIds: string[] = [];
  const falhas: string[] = [];

  for (const url of urls) {
    try {
      const { data } = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' });
      const nomeArquivo = url.split('/').pop()?.split('?')[0] || 'foto.jpg';
      const imageId = await uploadImagemShopee(accessToken, shopId, Buffer.from(data), nomeArquivo);
      imageIds.push(imageId);
    } catch (err: any) {
      console.error(`Falha ao enviar foto pra Shopee (${url}):`, err.response?.data || err.message);
      falhas.push(url);
    }
  }

  return { imageIds, falhas };
}

// ============================================================================
// Publicação — orquestra o fluxo completo
// ============================================================================

export interface ResultadoPublicacaoShopee {
  linkId: string;
  itemId: string;
  usaVariacoes: boolean;
  avisoFotos: string | null;
}

export async function publicarAnuncioShopee(supabase: SupabaseClient, accessToken: string, shopId: string, estoqueId: string, config: ConfiguracaoAnuncioShopee): Promise<ResultadoPublicacaoShopee> {
  // logistics_channel_id é obrigatório já na criação do item (Parte 1.2 da
  // proposta) — sem canal escolhido, recusa aqui em vez de publicar com um
  // valor neutro (a Shopee não tem equivalente ao "not_specified" do ML).
  if (!config.logisticsChannelId) throw new Error('Escolha um canal de logística antes de publicar na Shopee.');

  const { data: item, error: erroItem } = await supabase.from('estoque').select('id, nome, valor, quantidade, descricao, imagens').eq('id', estoqueId).maybeSingle();
  if (erroItem) throw erroItem;
  if (!item) throw new Error('Peça não encontrada.');

  const unidadeIds = (config.variacoes ?? []).map((v) => v.unidadeId);
  let unidades: UnidadeParaPublicarShopee[] = [];
  let fotosDasUnidades: string[] = [];
  if (unidadeIds.length > 0) {
    const { data, error } = await supabase.from('estoque_unidades').select('id, apelido, valor, fotos').in('id', unidadeIds);
    if (error) throw error;
    unidades = (data ?? []).map((u: any) => ({ id: u.id, apelido: u.apelido ?? null, valor: u.valor != null ? Number(u.valor) : null }));
    fotosDasUnidades = (data ?? []).flatMap((u: any) => u.fotos ?? []);
  }

  const margemPercentual = await obterMargemSincronizacaoShopee(supabase);

  // Reaproveita as fotos já cadastradas na peça (Fase 6: a seção "Fotos" do
  // modal não pede seleção nova, só mostra o que já existe) — mesma fonte
  // usada pelo Mercado Livre, mas re-hospedada via upload binário aqui.
  const urlsFotos = Array.from(new Set([...(item.imagens ?? []), ...fotosDasUnidades]));
  const { imageIds, falhas: fotosFalhas } = await uploadFotosParaShopee(accessToken, shopId, urlsFotos);
  if (urlsFotos.length > 0 && imageIds.length === 0) {
    throw new Error('Nenhuma foto pôde ser enviada pra Shopee — publicação cancelada (a Shopee exige ao menos 1 imagem no anúncio).');
  }

  const montado = montarPayloadPublicacaoShopee(item, unidades, config, imageIds, margemPercentual);

  const criado = await criarItemShopee(accessToken, shopId, montado.payloadItem);
  const itemId = String(criado.item_id);

  let respostaVariacoes: any = null;
  if (montado.usaVariacoes) {
    respostaVariacoes = await inicializarVariacoesShopee(accessToken, shopId, itemId, montado.tierVariation!, montado.modelList!);
  }

  const { data: link, error: erroLink } = await supabase
    .from('estoque_anuncios_shopee')
    .insert({
      estoque_id: estoqueId,
      shop_id: shopId,
      item_id: itemId,
      category_id: String(config.categoriaShopeeId),
      status_shopee: criado.item_status ?? null,
      atributos_shopee: config.atributos,
      publicado_em: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (erroLink) throw erroLink;

  if (montado.usaVariacoes) {
    // Formato de resposta do init_tier_variation não confirmado (mesma
    // ressalva de shopeeApi.ts::inicializarVariacoesShopee) — tenta os dois
    // nomes de campo mais prováveis (`model`/`model_list`) antes de desistir
    // de gravar o vínculo.
    const modelsResposta: any[] = respostaVariacoes?.model ?? respostaVariacoes?.model_list ?? [];
    const linhas = montado.ordemUnidades
      .map((unidadeId, indice) => {
        const model = modelsResposta[indice];
        return {
          link_id: link.id,
          unidade_id: unidadeId,
          model_id: model?.model_id != null ? String(model.model_id) : '',
          preco: montado.modelList![indice].original_price,
          quantidade: montado.modelList![indice].normal_stock,
        };
      })
      .filter((linha) => linha.model_id);
    if (linhas.length > 0) {
      const { error: erroVariacoes } = await supabase.from('estoque_anuncios_shopee_variacoes').insert(linhas);
      if (erroVariacoes && !ehErroDeMigrationAusente(erroVariacoes)) throw erroVariacoes;
    }
  }

  // Primeira leitura de estatísticas já no ato da publicação — não espera o
  // próximo ciclo do scheduler (Fase 7). Best-effort: erro aqui não derruba
  // a publicação, mesmo padrão de sincronizarEstatisticas do Mercado Livre.
  sincronizarEstatisticasShopee(supabase, accessToken, shopId, [link.id]).catch((err) => {
    console.error(`Erro ao buscar estatísticas iniciais do anúncio Shopee ${itemId}:`, err.response?.data || err.message);
  });

  return {
    linkId: link.id,
    itemId,
    usaVariacoes: montado.usaVariacoes,
    avisoFotos: fotosFalhas.length > 0 ? `${fotosFalhas.length} foto(s) não puderam ser enviadas pra Shopee e ficaram de fora do anúncio.` : null,
  };
}

// ============================================================================
// Republicar — reenvia preço/estoque atual da peça pro anúncio já publicado
// (Fase 4). Não existia uma função pra isso na Fase 3 original (a Fase 3 só
// cobriu o caminho de CRIAR); adicionada aqui porque a rota POST
// /:id/anuncios-shopee/:linkId/republicar (Fase 4) não tem como funcionar
// sem ela. Cobre item simples e item com variações (1 preço/estoque por
// model_id). update_price/update_stock NÃO foram confirmados no sandbox
// (mesma ressalva de shopeeApi.ts) — ajustar se o formato real divergir.
// ============================================================================

export interface ResultadoRepublicacaoShopee {
  linkId: string;
  itemId: string;
}

export async function republicarAnuncioShopee(supabase: SupabaseClient, accessToken: string, shopId: string, linkId: string): Promise<ResultadoRepublicacaoShopee> {
  const { data: link, error: erroLink } = await supabase.from('estoque_anuncios_shopee').select('id, item_id, estoque_id').eq('id', linkId).maybeSingle();
  if (erroLink) throw erroLink;
  if (!link) throw new Error('Anúncio não encontrado.');

  const { data: item, error: erroItem } = await supabase.from('estoque').select('valor, quantidade').eq('id', link.estoque_id).maybeSingle();
  if (erroItem) throw erroItem;
  if (!item) throw new Error('Peça não encontrada.');

  const margemPercentual = await obterMargemSincronizacaoShopee(supabase);
  const { data: variacoes, error: erroVariacoes } = await supabase.from('estoque_anuncios_shopee_variacoes').select('model_id, unidade_id').eq('link_id', linkId);
  if (erroVariacoes && !ehErroDeMigrationAusente(erroVariacoes)) throw erroVariacoes;

  if (!variacoes || variacoes.length === 0) {
    const preco = calcularPrecoComMargem(Number(item.valor), margemPercentual);
    await atualizarPrecoItemShopee(accessToken, shopId, link.item_id, [{ original_price: preco }]);
    await atualizarEstoqueItemShopee(accessToken, shopId, link.item_id, [{ seller_stock: [{ stock: item.quantidade }] }]);
    return { linkId: link.id, itemId: link.item_id };
  }

  const unidadeIds = variacoes.map((v: any) => v.unidade_id).filter(Boolean);
  const { data: unidades, error: erroUnidades } = await supabase.from('estoque_unidades').select('id, valor').in('id', unidadeIds);
  if (erroUnidades) throw erroUnidades;
  const valorPorUnidade = new Map((unidades ?? []).map((u: any) => [u.id, u.valor != null ? Number(u.valor) : null]));

  const priceList = variacoes
    .filter((v: any) => v.model_id)
    .map((v: any) => ({
      model_id: Number(v.model_id),
      original_price: calcularPrecoComMargem(valorPorUnidade.get(v.unidade_id) ?? Number(item.valor), margemPercentual),
    }));
  await atualizarPrecoItemShopee(accessToken, shopId, link.item_id, priceList);
  await atualizarEstoqueItemShopee(
    accessToken,
    shopId,
    link.item_id,
    priceList.map((p) => ({ model_id: p.model_id, seller_stock: [{ stock: 1 }] }))
  );

  return { linkId: link.id, itemId: link.item_id };
}

// ============================================================================
// Estatísticas (Fase 7) — snapshot lido pelo modal de detalhes, escrito por
// aqui (chamado no ato da publicação e pelo scheduler em background). Nunca
// chamado no clique do usuário abrindo o modal.
// ============================================================================

export async function sincronizarEstatisticasShopee(supabase: SupabaseClient, accessToken: string, shopId: string, linkIds: string[]): Promise<void> {
  if (linkIds.length === 0) return;

  const { data: links, error } = await supabase.from('estoque_anuncios_shopee').select('id, item_id').in('id', linkIds);
  if (error) {
    if (ehErroDeMigrationAusente(error)) return;
    throw error;
  }
  if (!links || links.length === 0) return;

  const itemIds = links.map((l: any) => l.item_id);
  const estatisticas = await buscarEstatisticasItemShopee(accessToken, shopId, itemIds);

  const linhas = links.map((link: any) => {
    const stat = estatisticas[link.item_id];
    return {
      link_id: link.id,
      visitas_total: stat?.visitasTotal ?? null,
      vendas_totais: stat?.vendasTotais ?? null,
      status_shopee: stat?.statusShopee ?? null,
      atualizado_em: new Date().toISOString(),
    };
  });

  const { error: erroUpsert } = await supabase.from('estoque_anuncios_shopee_estatisticas').upsert(linhas, { onConflict: 'link_id' });
  if (erroUpsert && !ehErroDeMigrationAusente(erroUpsert)) throw erroUpsert;
}
