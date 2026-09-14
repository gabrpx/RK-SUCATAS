// Cliente puro da API da Shopee (Open Platform v2). Só fala com a API
// oficial da Shopee e com a tabela shopee_conexao (token da loja) — nunca
// acessa estoque, vendas ou qualquer outra tabela de domínio. Quem cruza
// isso com o resto do sistema é src/services/shopeePublicacao.ts. Companheiro
// de src/services/mercadolivreApi.ts, mesmo estilo de organização.
import type { SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';
import crypto from 'crypto';
import { requireEnv } from '../server/env.js';

// Produção por padrão. Durante os testes da FASE 8, apontar a variável de
// ambiente SHOPEE_API_URL pro host de sandbox
// (https://partner.test-stable.shopeemobile.com) sem precisar mudar código.
const SHOPEE_API_URL = process.env.SHOPEE_API_URL || 'https://partner.shopeemobile.com';
export const TABELA_CONEXAO = 'shopee_conexao';

interface ConexaoShopee {
  shopId: string;
  accessToken: string;
}

// -----------------------------------------------------------------------
// Assinatura HMAC-SHA256 — TODA chamada à API da Shopee passa por aqui
// (diretamente ou via chamarApiShopee abaixo). Diferente do Mercado Livre
// (token simples no header), a Shopee exige um `sign` calculado por
// requisição: partner_id + path + timestamp nas chamadas públicas (login,
// troca/renovação de token), mais access_token + shop_id nas chamadas
// autenticadas de loja (produto, logística, etc.).
// -----------------------------------------------------------------------
function assinarRequisicaoShopee(path: string, timestamp: number, accessToken?: string, shopId?: string): string {
  const partnerId = requireEnv('SHOPEE_PARTNER_ID');
  const partnerKey = requireEnv('SHOPEE_PARTNER_KEY');
  const base = accessToken && shopId ? `${partnerId}${path}${timestamp}${accessToken}${shopId}` : `${partnerId}${path}${timestamp}`;
  return crypto.createHmac('sha256', partnerKey).update(base).digest('hex');
}

// Monta e dispara uma chamada assinada. Todo o resto deste arquivo (exceto
// uploadImagemShopee, que precisa de corpo multipart) passa por aqui — nunca
// monta uma URL/assinatura na mão em outro lugar.
async function chamarApiShopee<T = any>(
  method: 'get' | 'post',
  path: string,
  opts: { accessToken?: string; shopId?: string; params?: Record<string, any>; data?: any } = {}
): Promise<T> {
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = assinarRequisicaoShopee(path, timestamp, opts.accessToken, opts.shopId);

  const params: Record<string, any> = {
    partner_id: requireEnv('SHOPEE_PARTNER_ID'),
    timestamp,
    sign,
    ...opts.params,
  };
  if (opts.accessToken) params.access_token = opts.accessToken;
  if (opts.shopId) params.shop_id = opts.shopId;

  const { data } = await axios.request<T>({ method, url: `${SHOPEE_API_URL}${path}`, params, data: opts.data });
  return data;
}

// -----------------------------------------------------------------------
// OAuth + conexão — mesmo papel de trocarTokens/obterConexaoAtual em
// mercadolivreApi.ts, com o vocabulário da Shopee (shop_id no lugar de
// ml_user_id).
// -----------------------------------------------------------------------

// Gera a URL de login da loja Shopee. O frontend chama isso (autenticado) e
// faz `window.location = url` — a troca de code por token de verdade
// acontece no callback público, ver trocarCodigoPorTokenShopee. `state` é
// repassado cru pro parâmetro `state` da Shopee (devolvido sem alteração no
// callback) — quem chama usa isso pra CSRF, mesmo papel do `state` do fluxo
// OAuth do Mercado Livre em src/server/routes/mercadolivre.ts.
export function gerarUrlAutorizacaoShopee(state: string): string {
  const path = '/api/v2/shop/auth_partner';
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = assinarRequisicaoShopee(path, timestamp);

  const url = new URL(`${SHOPEE_API_URL}${path}`);
  url.searchParams.set('partner_id', requireEnv('SHOPEE_PARTNER_ID'));
  url.searchParams.set('timestamp', String(timestamp));
  url.searchParams.set('sign', sign);
  url.searchParams.set('redirect', requireEnv('SHOPEE_REDIRECT_URI'));
  url.searchParams.set('state', state);
  return url.toString();
}

async function persistirConexao(supabase: SupabaseClient, shopId: string, data: any): Promise<ConexaoShopee> {
  if (data?.error) throw new Error(data.message ?? `Erro de autenticação na Shopee: ${data.error}`);

  const expiraEm = new Date(Date.now() + data.expire_in * 1000).toISOString();
  const { error } = await supabase.from(TABELA_CONEXAO).upsert(
    {
      shop_id: shopId,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expira_em: expiraEm,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'shop_id' }
  );
  if (error) throw error;

  return { shopId, accessToken: data.access_token };
}

// Troca o `code` do callback OAuth por access_token/refresh_token — a Shopee
// devolve os dois já atrelados ao shop_id que o vendedor autorizou (vem na
// query string do próprio redirect, junto com o code). Persiste em
// shopee_conexao.
export async function trocarCodigoPorTokenShopee(supabase: SupabaseClient, code: string, shopId: string): Promise<ConexaoShopee> {
  const data = await chamarApiShopee<any>('post', '/api/v2/auth/token/get', {
    data: { code, shop_id: Number(shopId), partner_id: Number(requireEnv('SHOPEE_PARTNER_ID')) },
  });
  return persistirConexao(supabase, shopId, data);
}

// Renova o access_token usando o refresh_token. access_token dura só 4h
// (bem mais curto que as 6h do Mercado Livre) — chamado pelo scheduler da
// FASE 7 com cadência própria, não reaproveita o timer do
// mercadolivreScheduler.ts. refresh_token dura 30 dias.
export async function renovarTokenShopee(supabase: SupabaseClient, refreshToken: string, shopId: string): Promise<ConexaoShopee> {
  const data = await chamarApiShopee<any>('post', '/api/v2/auth/access_token/get', {
    data: { refresh_token: refreshToken, shop_id: Number(shopId), partner_id: Number(requireEnv('SHOPEE_PARTNER_ID')) },
  });
  return persistirConexao(supabase, shopId, data);
}

// Token + shop_id prontos pra usar — renova sozinho quando falta pouco pra
// expirar. Janela de segurança de 10min (proporcionalmente maior que os 5min
// do ML, porque o token da Shopee dura só 4h contra 6h do ML). Assume uma
// única loja conectada, mesmo espírito de obterConexaoAtual do Mercado
// Livre. Retorna null se ninguém conectou a loja ainda.
export async function obterConexaoAtualShopee(supabase: SupabaseClient): Promise<ConexaoShopee | null> {
  const { data: conexao } = await supabase.from(TABELA_CONEXAO).select('*').order('atualizado_em', { ascending: false }).limit(1).maybeSingle();
  if (!conexao) return null;

  const faltamMs = new Date(conexao.expira_em).getTime() - Date.now();
  if (faltamMs > 10 * 60 * 1000) return { shopId: conexao.shop_id, accessToken: conexao.access_token };

  return renovarTokenShopee(supabase, conexao.refresh_token, conexao.shop_id);
}

const MARGEM_PADRAO_SHOPEE = 30;

// Margem própria do canal Shopee — NÃO reaproveita
// mercadolivre_conexao.margem_sincronizacao_percentual, canais diferentes
// podem ter margens diferentes. Mesmo fallback gracioso de
// obterMargemSincronizacao (ML): 30% se ninguém conectou a loja ainda ou se
// a migration_045 não tiver rodado.
export async function obterMargemSincronizacaoShopee(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.from(TABELA_CONEXAO).select('margem_sincronizacao_percentual').order('atualizado_em', { ascending: false }).limit(1).maybeSingle();
  if (error) {
    if (error.code === '42703' || error.code === 'PGRST204' || error.code === 'PGRST205' || error.code === '42P01') return MARGEM_PADRAO_SHOPEE;
    throw error;
  }
  return data?.margem_sincronizacao_percentual != null ? Number(data.margem_sincronizacao_percentual) : MARGEM_PADRAO_SHOPEE;
}

export async function atualizarMargemSincronizacaoShopee(supabase: SupabaseClient, margemPercentual: number): Promise<void> {
  const { error, count } = await supabase.from(TABELA_CONEXAO).update({ margem_sincronizacao_percentual: margemPercentual }, { count: 'exact' }).not('shop_id', 'is', null);
  if (error) throw error;
  if (!count) throw new Error('Conecte a loja da Shopee antes de configurar a margem.');
}

// -----------------------------------------------------------------------
// Categorias e atributos
// -----------------------------------------------------------------------

export interface CategoriaShopee {
  categoryId: number;
  categoryName: string;
  hasChildren: boolean;
  parentCategoryId: number;
}

// GET /api/v2/product/get_category — diferente do Mercado Livre (que tem um
// endpoint por categoria: buscarCategoriasRaizML + buscarCategoriaML), a
// Shopee devolve a árvore INTEIRA achatada numa chamada só, sem parâmetro de
// id. buscarCategoriasRaizShopee e buscarCategoriaShopee abaixo derivam o
// que precisam dessa mesma resposta filtrando por parent_category_id — não
// são duas chamadas de API diferentes, só duas visões sobre a mesma lista.
async function buscarArvoreCategoriasShopee(accessToken: string, shopId: string): Promise<CategoriaShopee[]> {
  const data = await chamarApiShopee<any>('get', '/api/v2/product/get_category', { accessToken, shopId, params: { language: 'pt-br' } });
  return (data?.response?.category_list ?? []).map((c: any) => ({
    categoryId: c.category_id,
    categoryName: c.category_name,
    hasChildren: c.has_children,
    parentCategoryId: c.parent_category_id,
  }));
}

export async function buscarCategoriasRaizShopee(accessToken: string, shopId: string): Promise<CategoriaShopee[]> {
  const todas = await buscarArvoreCategoriasShopee(accessToken, shopId);
  return todas.filter((c) => c.parentCategoryId === 0);
}

export async function buscarCategoriaShopee(accessToken: string, shopId: string, categoriaId: number): Promise<{ categoria: CategoriaShopee | null; filhos: CategoriaShopee[] }> {
  const todas = await buscarArvoreCategoriasShopee(accessToken, shopId);
  return { categoria: todas.find((c) => c.categoryId === categoriaId) ?? null, filhos: todas.filter((c) => c.parentCategoryId === categoriaId) };
}

export interface AtributoCategoriaShopee {
  attributeId: number;
  name: string;
  isMandatory: boolean;
  inputType: string;
  values?: { valueId: number; originalValueName: string }[];
}

// GET /api/v2/product/category/attribute/get — atributos da categoria.
//
// NÃO CONFIRMADO NO SANDBOX: docs/proposta-publicacao-shopee.md (seção 1.3)
// registra que o nome exato deste endpoint diverge entre fontes secundárias
// (`category/attribute/get` vs `get_attribute_tree`) — nenhuma delas é a
// documentação oficial. category/attribute/get é tentado primeiro (nome mais
// citado); se a resposta vier com `error` preenchido, tenta
// get_attribute_tree como fallback. Ajustar esta função pra uma chamada só
// assim que a FASE 8 confirmar qual dos dois é o certo.
export async function buscarAtributosCategoriaShopee(accessToken: string, shopId: string, categoriaId: number): Promise<AtributoCategoriaShopee[]> {
  const params = { category_id: categoriaId, language: 'pt-br' };
  let data = await chamarApiShopee<any>('get', '/api/v2/product/category/attribute/get', { accessToken, shopId, params });
  if (data?.error) {
    data = await chamarApiShopee<any>('get', '/api/v2/product/get_attribute_tree', { accessToken, shopId, params });
  }
  if (data?.error) throw new Error(data.message ?? `Erro ao buscar atributos da categoria ${categoriaId} na Shopee: ${data.error}`);

  return (data?.response?.attribute_list ?? []).map((a: any) => ({
    attributeId: a.attribute_id,
    name: a.original_attribute_name ?? a.display_attribute_name,
    isMandatory: !!a.is_mandatory,
    inputType: a.input_validation_type ?? 'TEXT_FIELD',
    values: a.attribute_value_list?.map((v: any) => ({ valueId: v.value_id, originalValueName: v.original_value_name })),
  }));
}

// -----------------------------------------------------------------------
// Logística
// -----------------------------------------------------------------------

export interface CanalLogisticaShopee {
  logisticsChannelId: number;
  logisticsChannelName: string;
  enabled: boolean;
}

// GET /api/v2/logistics/get_channel_list — canais de logística habilitados
// pra loja. logistics_channel_id é OBRIGATÓRIO já na criação do item
// (add_item) — diferente do Mercado Livre, que aceita shipping.mode:
// "not_specified" e resolve o frete depois, na venda.
export async function buscarCanaisLogisticaShopee(accessToken: string, shopId: string): Promise<CanalLogisticaShopee[]> {
  const data = await chamarApiShopee<any>('get', '/api/v2/logistics/get_channel_list', { accessToken, shopId });
  return (data?.response?.logistics_channel_list ?? []).map((c: any) => ({
    logisticsChannelId: c.logistics_channel_id,
    logisticsChannelName: c.logistics_channel_name,
    enabled: !!c.enabled,
  }));
}

// -----------------------------------------------------------------------
// Fotos, item e variações
// -----------------------------------------------------------------------

// POST /api/v2/media_space/upload_image — upload binário prévio (multipart).
// Diferente do Mercado Livre, que aceita URL por referência (pictures:
// [{source: url}]): a Shopee exige os bytes da imagem já em mãos. Quem chama
// baixa do Supabase Storage antes de invocar esta função (ver
// uploadFotosParaShopee em shopeePublicacao.ts, FASE 3). Devolve o image_id
// estável a persistir — a URL do CDN da Shopee expira, o id não. Não passa
// por chamarApiShopee porque o corpo é multipart, não JSON.
export async function uploadImagemShopee(accessToken: string, shopId: string, buffer: Buffer, nomeArquivo: string): Promise<string> {
  const path = '/api/v2/media_space/upload_image';
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = assinarRequisicaoShopee(path, timestamp, accessToken, shopId);

  const form = new FormData();
  form.append('image', new Blob([buffer]), nomeArquivo);

  const { data } = await axios.post(`${SHOPEE_API_URL}${path}`, form, {
    params: { partner_id: requireEnv('SHOPEE_PARTNER_ID'), timestamp, sign, access_token: accessToken, shop_id: shopId },
  });

  if (data?.error) throw new Error(data.message ?? `Erro ao enviar imagem pra Shopee: ${data.error}`);
  const imageId = data?.response?.image_info?.image_id;
  if (!imageId) throw new Error('Shopee não devolveu image_id no upload.');
  return imageId;
}

// POST /api/v2/product/add_item — cria o item base. O payload é montado por
// montarPayloadPublicacaoShopee() em shopeePublicacao.ts; aqui só repassa cru
// pra API e devolve a resposta cru (item_id, etc.) — quem chama decide o que
// persistir.
export async function criarItemShopee(accessToken: string, shopId: string, payload: Record<string, any>): Promise<any> {
  const data = await chamarApiShopee<any>('post', '/api/v2/product/add_item', { accessToken, shopId, data: payload });
  if (data?.error) throw new Error(data.message ?? `Erro ao criar item na Shopee: ${data.error}`);
  return data.response;
}

// POST /api/v2/product/init_tier_variation — inicializa o item como
// tier-variation e define preço/estoque de cada model.
//
// NÃO CONFIRMADO NO SANDBOX: os SDKs de terceiros consultados na pesquisa
// (docs/proposta-publicacao-shopee.md, seção 1.4 — go-shopee, shopeego,
// python-shopee) descrevem isto como uma chamada SEPARADA de add_item, sem
// poder editar tier_variation/preço/estoque depois de criado (updates usam
// update_tier_variation_list, não implementado aqui). Este agente não tem
// credenciais de Partner Platform nem acesso ao sandbox
// (partner.test-stable.shopeemobile.com) pra confirmar isso na prática — a
// FASE 8 do plano exige testar isto ANTES de publicar qualquer peça real com
// variações, e ajustar (ou fundir com criarItemShopee, se o teste mostrar
// que dá pra mandar tier_variation no mesmo add_item) assim que confirmado.
export async function inicializarVariacoesShopee(
  accessToken: string,
  shopId: string,
  itemId: string,
  tierVariation: { name: string; option_list: { option: string; image?: { image_id: string } }[] }[],
  modelList: { tier_index: number[]; normal_stock: number; original_price: number }[]
): Promise<any> {
  const data = await chamarApiShopee<any>('post', '/api/v2/product/init_tier_variation', {
    accessToken,
    shopId,
    data: { item_id: Number(itemId), tier_variation: tierVariation, model: modelList },
  });
  if (data?.error) throw new Error(data.message ?? `Erro ao inicializar variações na Shopee: ${data.error}`);
  return data.response;
}

// POST /api/v2/product/update_price — atualiza preço de um item já
// publicado. `priceList` sem `model_id` atualiza o item simples; com
// `model_id`, atualiza o model (variação) específico — mesma chamada cobre
// os dois casos, conforme o schema mais citado nas fontes consultadas.
// Usada por republicarAnuncioShopee (shopeePublicacao.ts, FASE 4) pra
// reenviar preço atual da peça. NÃO CONFIRMADO NO SANDBOX.
export async function atualizarPrecoItemShopee(accessToken: string, shopId: string, itemId: string, priceList: { model_id?: number; original_price: number }[]): Promise<void> {
  const data = await chamarApiShopee<any>('post', '/api/v2/product/update_price', { accessToken, shopId, data: { item_id: Number(itemId), price_list: priceList } });
  if (data?.error) throw new Error(data.message ?? `Erro ao atualizar preço na Shopee: ${data.error}`);
}

// POST /api/v2/product/update_stock — mesma lógica de atualizarPrecoItemShopee
// pra estoque. NÃO CONFIRMADO NO SANDBOX.
export async function atualizarEstoqueItemShopee(accessToken: string, shopId: string, itemId: string, stockList: { model_id?: number; seller_stock: { stock: number }[] }[]): Promise<void> {
  const data = await chamarApiShopee<any>('post', '/api/v2/product/update_stock', { accessToken, shopId, data: { item_id: Number(itemId), stock_list: stockList } });
  if (data?.error) throw new Error(data.message ?? `Erro ao atualizar estoque na Shopee: ${data.error}`);
}

// -----------------------------------------------------------------------
// Estatísticas
// -----------------------------------------------------------------------

export interface EstatisticaItemShopee {
  visitasTotal: number | null;
  vendasTotais: number | null;
  statusShopee: string | null;
}

// GET /api/v2/product/get_item_base_info — estatísticas básicas por item, em
// lote. Campos exatos (visitas/vendas/status) ainda NÃO confirmados contra a
// resposta real da API — mesma ressalva já registrada em
// estoque_anuncios_shopee_estatisticas (migration_045); ajustar na FASE 7 se
// a resposta real divergir do que está mapeado abaixo.
export async function buscarEstatisticasItemShopee(accessToken: string, shopId: string, itemIds: string[]): Promise<Record<string, EstatisticaItemShopee>> {
  if (itemIds.length === 0) return {};
  const data = await chamarApiShopee<any>('get', '/api/v2/product/get_item_base_info', {
    accessToken,
    shopId,
    params: { item_id_list: itemIds.join(',') },
  });
  if (data?.error) throw new Error(data.message ?? `Erro ao buscar estatísticas de itens na Shopee: ${data.error}`);

  const resultado: Record<string, EstatisticaItemShopee> = {};
  for (const item of data?.response?.item_list ?? []) {
    resultado[String(item.item_id)] = {
      visitasTotal: item.item_status_stat?.view_count ?? null,
      vendasTotais: item.sales ?? null,
      statusShopee: item.item_status ?? null,
    };
  }
  return resultado;
}
