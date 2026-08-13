// Cliente puro da API do Mercado Livre. Só fala com a API oficial do ML e com
// a tabela mercadolivre_conexao (token da conta) — nunca acessa estoque,
// vendas ou qualquer outra tabela de domínio. Quem cruza isso com o resto do
// sistema é src/services/mercadolivreSync.ts.
import type { SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';
import { requireEnv } from '../server/env.js';

const ML_API_URL = 'https://api.mercadolibre.com';
export const TABELA_CONEXAO = 'mercadolivre_conexao';

interface ConexaoML {
  mlUserId: string;
  accessToken: string;
}

// Troca um `code` (primeiro login) ou `refresh_token` (renovação) por um
// access_token novo, e já persiste o resultado. Mesmo formato de resposta
// nos dois casos — a API do Mercado Livre não distingue no retorno.
export async function trocarTokens(supabase: SupabaseClient, params: Record<string, string>): Promise<ConexaoML> {
  const { data } = await axios.post(`${ML_API_URL}/oauth/token`, null, {
    params: {
      client_id: requireEnv('MERCADOLIVRE_APP_ID'),
      client_secret: requireEnv('MERCADOLIVRE_CLIENT_SECRET'),
      ...params,
    },
    headers: { Accept: 'application/json' },
  });

  const expiraEm = new Date(Date.now() + data.expires_in * 1000).toISOString();
  const { error } = await supabase.from(TABELA_CONEXAO).upsert(
    {
      ml_user_id: String(data.user_id),
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expira_em: expiraEm,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'ml_user_id' }
  );
  if (error) throw error;

  return { mlUserId: String(data.user_id), accessToken: data.access_token as string };
}

// Token + id da conta prontos pra usar — renova sozinho quando falta pouco
// pra expirar (token dura 6h). Assume uma única loja conectada: pega sempre a
// conexão mais recente. Retorna null se ninguém conectou a conta ainda.
export async function obterConexaoAtual(supabase: SupabaseClient): Promise<ConexaoML | null> {
  const { data: conexao } = await supabase.from(TABELA_CONEXAO).select('*').order('atualizado_em', { ascending: false }).limit(1).maybeSingle();
  if (!conexao) return null;

  const faltamMs = new Date(conexao.expira_em).getTime() - Date.now();
  if (faltamMs > 5 * 60 * 1000) return { mlUserId: conexao.ml_user_id, accessToken: conexao.access_token };

  return trocarTokens(supabase, { grant_type: 'refresh_token', refresh_token: conexao.refresh_token });
}

// Atalho pra quem só precisa do token (ex: rota /me, que já tinha esse
// formato antes deste arquivo existir) — mantém o nome/comportamento
// originais de src/server/routes/mercadolivre.ts.
export async function obterAccessTokenValido(supabase: SupabaseClient): Promise<string | null> {
  const conexao = await obterConexaoAtual(supabase);
  return conexao?.accessToken ?? null;
}

const MARGEM_PADRAO = 30;

// Fallback pro padrão de 30% tanto se ninguém conectou a conta ainda quanto
// se a migration_026 não tiver rodado (coluna ausente) — mesmo espírito de
// nunca quebrar a tela por migração pendente que o resto do sistema usa.
export async function obterMargemSincronizacao(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from(TABELA_CONEXAO)
    .select('margem_sincronizacao_percentual')
    .order('atualizado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (error.code === '42703' || error.code === 'PGRST204' || error.code === 'PGRST205') return MARGEM_PADRAO;
    throw error;
  }
  return data?.margem_sincronizacao_percentual != null ? Number(data.margem_sincronizacao_percentual) : MARGEM_PADRAO;
}

// update, não upsert: só faz sentido mudar a margem de uma conta que já
// existe (é o mesmo idioma de "a única linha esperada" já usado em
// DELETE /desconectar, src/server/routes/mercadolivre.ts).
export async function atualizarMargemSincronizacao(supabase: SupabaseClient, margemPercentual: number): Promise<void> {
  const { error, count } = await supabase
    .from(TABELA_CONEXAO)
    .update({ margem_sincronizacao_percentual: margemPercentual }, { count: 'exact' })
    .not('ml_user_id', 'is', null);
  if (error) throw error;
  if (!count) throw new Error('Conecte a conta do Mercado Livre antes de configurar a margem.');
}

// Extrai o id MLB de um link colado à mão (estoque.anuncio_ml_url não tem
// validação de formato em nenhuma camada — pode ser qualquer string). Casa
// tanto "MLB1234567890" quanto "MLB-1234567890" (formato usado na URL do
// anúncio), em qualquer posição do texto. Links curtos (mercadolivre.com/sec/...)
// não têm o id no texto e por isso não casam — quem chama trata `null` como
// "não dá pra sincronizar este item automaticamente".
const MLB_ID_REGEX = /MLB-?(\d{6,12})/i;

export function extrairMlbId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(MLB_ID_REGEX);
  return match ? `MLB${match[1]}` : null;
}

function dividirEmLotes<T>(lista: T[], tamanho: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho) lotes.push(lista.slice(i, i + tamanho));
  return lotes;
}

export async function buscarItemML(token: string, mlbId: string): Promise<any> {
  const { data } = await axios.get(`${ML_API_URL}/items/${mlbId}`, { headers: { Authorization: `Bearer ${token}` } });
  return data;
}

// GET /items?ids= aceita no máximo 20 ids por chamada — o chunking é
// sequencial (não Promise.all disparando tudo de uma vez), mesmo estilo
// pragmático do loop de vender-tudo em orcamentos.ts. Cada entrada da
// resposta vem como { code, body }; só aproveita quem voltou 200.
export async function buscarItensPorIds(token: string, ids: string[]): Promise<any[]> {
  if (ids.length === 0) return [];
  const resultados: any[] = [];
  for (const lote of dividirEmLotes(ids, 20)) {
    const { data } = await axios.get(`${ML_API_URL}/items`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { ids: lote.join(',') },
    });
    for (const entrada of data ?? []) {
      if (entrada.code === 200 && entrada.body) resultados.push(entrada.body);
    }
  }
  return resultados;
}

export interface AtualizacaoItemML {
  price?: number;
  available_quantity?: number;
  status?: 'active' | 'paused';
}

export async function atualizarItemML(token: string, mlbId: string, atualizacao: AtualizacaoItemML): Promise<void> {
  await axios.put(`${ML_API_URL}/items/${mlbId}`, atualizacao, { headers: { Authorization: `Bearer ${token}` } });
}

// Paginação simples (offset/limit) — suficiente pra dezenas/poucas centenas
// de anúncios. O modo `search_type=scan` existe pra bases muito maiores (tem
// scroll_id com expiração de 5min pra gerenciar) e não vale a complexidade
// no tamanho de catálogo de uma sucata.
export async function buscarItensAtivosVendedor(token: string, mlUserId: string): Promise<string[]> {
  const ids: string[] = [];
  const limit = 50;
  let offset = 0;

  while (true) {
    const { data } = await axios.get(`${ML_API_URL}/users/${mlUserId}/items/search`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { status: 'active', offset, limit },
    });
    const pagina: string[] = data?.results ?? [];
    ids.push(...pagina);
    const total = data?.paging?.total ?? ids.length;
    offset += limit;
    if (pagina.length === 0 || offset >= total) break;
  }

  return ids;
}

export interface ItemPedidoML {
  item: { id: string; title: string };
  quantity: number;
  unit_price: number;
}

export interface PedidoML {
  id: number;
  date_created: string;
  status: string;
  buyer?: { nickname?: string; id?: number };
  order_items: ItemPedidoML[];
  shipping?: { id: number | null };
}

export async function buscarPedidosRecentes(token: string, mlUserId: string, desde: Date): Promise<PedidoML[]> {
  const { data } = await axios.get(`${ML_API_URL}/orders/search`, {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      seller: mlUserId,
      'order.status': 'paid',
      'order.date_created.from': desde.toISOString(),
      sort: 'date_desc',
    },
  });
  return data?.results ?? [];
}

export interface EnvioML {
  id: number;
  status: string;
  substatus: string | null;
  trackingNumber: string | null;
  cost: number | null;
}

export async function buscarEnvio(token: string, shippingId: string): Promise<EnvioML> {
  // x-format-new: true é exigido pela API pra devolver o formato atual do
  // recurso de envio (sem isso, alguns campos vêm no formato legado).
  const { data } = await axios.get(`${ML_API_URL}/shipments/${shippingId}`, {
    headers: { Authorization: `Bearer ${token}`, 'x-format-new': 'true' },
  });
  return {
    id: data.id,
    status: data.status,
    substatus: data.substatus ?? null,
    trackingNumber: data.tracking_number ?? null,
    cost: data.shipping_option?.cost ?? data.declared_value ?? null,
  };
}

export interface PerguntaML {
  id: number;
  item_id: string;
  text: string;
  date_created: string;
  status: string;
}

export async function buscarPerguntas(token: string, mlUserId: string, status: string = 'UNANSWERED'): Promise<PerguntaML[]> {
  try {
    const { data } = await axios.get(`${ML_API_URL}/questions/search`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { seller_id: mlUserId, status, api_version: 4 },
    });
    return data?.questions ?? data?.results ?? [];
  } catch (err: any) {
    // A API devolve 404 quando o vendedor ainda não tem nenhuma pergunta —
    // isso é "lista vazia", não uma falha de verdade.
    if (err.response?.status === 404) return [];
    throw err;
  }
}

export async function responderPergunta(token: string, questionId: number, texto: string): Promise<void> {
  await axios.post(`${ML_API_URL}/answers`, { question_id: questionId, text: texto }, { headers: { Authorization: `Bearer ${token}` } });
}

// -----------------------------------------------------------------------
// Publicação de anúncios novos (migration_043) — cria o anúncio, nunca só
// lê. Site fixo em MLB porque esta integração é sempre doméstica (Brasil),
// nunca Global Selling/CBT (ver comentário no topo de
// src/services/mercadolivrePublicacao.ts).
// -----------------------------------------------------------------------
const SITE_ID = 'MLB';

export interface PredicaoCategoriaML {
  domain_id: string;
  domain_name: string;
  category_id: string;
  category_name: string;
  attributes: { id: string; value_id: string | null; value_name: string | null }[];
}

// GET /sites/{site}/domain_discovery/search — o preditor de categoria.
// Devolve uma lista ordenada por probabilidade (o primeiro resultado é o
// mais provável, segundo a documentação oficial) — quem chama decide
// quantos mostrar. Cada entrada já vem com sugestão de valor pra alguns
// atributos (ex: marca/modelo), mas não com a lista completa de atributos
// da categoria — isso é buscarAtributosCategoriaML, à parte.
export async function predizerCategoria(token: string, titulo: string): Promise<PredicaoCategoriaML[]> {
  const { data } = await axios.get(`${ML_API_URL}/sites/${SITE_ID}/domain_discovery/search`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { q: titulo, limit: 4 },
  });
  return data ?? [];
}

export interface AtributoCategoriaML {
  id: string;
  name: string;
  value_type: string;
  tags: Record<string, boolean>;
  values?: { id: string; name: string }[];
  attribute_group_id?: string;
  attribute_group_name?: string;
}

// GET /categories/{id}/attributes — schema completo dos atributos da
// categoria (quais são obrigatórios, quais aceitam variação, tipo de valor
// esperado). `tags` é um objeto de flags booleanas (required,
// allow_variations, variation_attribute, catalog_required, fixed, ...), não
// uma lista — cada atributo só carrega as flags que se aplicam a ele.
export async function buscarAtributosCategoriaML(token: string, categoriaId: string): Promise<AtributoCategoriaML[]> {
  const { data } = await axios.get(`${ML_API_URL}/categories/${categoriaId}/attributes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data ?? [];
}

export interface TipoAnuncioPrecoML {
  listing_type_id: string;
  listing_type_name: string;
  listing_exposure: string;
  requires_picture: boolean;
  currency_id: string;
  listing_fee_amount: number;
  sale_fee_amount: number;
  free_relist: boolean;
  stop_time: string;
}

// listing_type_id que ainda valem no site MLB — a API continua devolvendo
// tipos descontinuados (free, silver, bronze, gold, gold_premium) por
// retrocompatibilidade com contas antigas; filtramos aqui pra quem chama
// nunca precisar saber disso (não existe mais o tipo "Grátis" no Brasil).
const LISTING_TYPES_VIGENTES = ['gold_special', 'gold_pro'];

// GET /sites/{site}/listing_prices?price= — taxas por tipo de anúncio pro
// preço informado. A API não expõe um filtro por categoria nesse recurso —
// preço é o único filtro que ela aceita aqui.
export async function buscarTiposAnuncioML(token: string, preco: number): Promise<TipoAnuncioPrecoML[]> {
  const { data } = await axios.get(`${ML_API_URL}/sites/${SITE_ID}/listing_prices`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { price: preco },
  });
  return (data ?? []).filter((tipo: TipoAnuncioPrecoML) => LISTING_TYPES_VIGENTES.includes(tipo.listing_type_id));
}

// POST /items — cria o anúncio. O payload é montado por
// montarPayloadPublicacao() em mercadolivrePublicacao.ts; aqui só repassa
// cru pra API e devolve a resposta cru (id, permalink, variations[] já com
// os ids atribuídos pelo ML, etc.) — quem chama decide o que persistir.
export async function criarItemML(token: string, payload: Record<string, any>): Promise<any> {
  const { data } = await axios.post(`${ML_API_URL}/items`, payload, { headers: { Authorization: `Bearer ${token}` } });
  return data;
}

// POST /items/{id}/description — de propósito separado do POST /items: a
// API não é transacional entre os dois passos, então se este falhar o
// anúncio já existe sem descrição e precisa poder ser reexecutado sozinho.
export async function atualizarDescricaoML(token: string, itemId: string, texto: string): Promise<void> {
  await axios.post(`${ML_API_URL}/items/${itemId}/description`, { plain_text: texto }, { headers: { Authorization: `Bearer ${token}` } });
}

// GET /visits/items?ids= — total de visitas desde a criação do anúncio
// (até 2 anos), por item; a resposta vem como um objeto { itemId: total },
// não um array. NÃO confundir com /items/visits?ids= (singular no início) —
// esse outro endpoint, apesar do nome parecido, só aceita 1 id por chamada
// e devolve um objeto único (não um mapa). A doc da própria API sugere lote,
// mas testado ao vivo (conta real, 18 ids de uma vez): devolve 400
// "maximum amount of items to query is 1" — 1 chamada por item, mesmo
// batching de buscarVisitasUltimosDias abaixo, não os 20 de buscarItensPorIds.
export async function buscarVisitasItem(token: string, itemIds: string[]): Promise<Record<string, number>> {
  if (itemIds.length === 0) return {};
  const totais: Record<string, number> = {};
  for (const id of itemIds) {
    const { data } = await axios.get(`${ML_API_URL}/visits/items`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { ids: id },
    });
    Object.assign(totais, data ?? {});
  }
  return totais;
}

// GET /items/{id}/visits/time_window?last=&unit=day — só aceita 1 item por
// chamada. Usado pra "visitas nos últimos N dias", que /visits/items (acima)
// não oferece — só dá o total histórico.
export async function buscarVisitasUltimosDias(token: string, itemId: string, dias: number): Promise<number> {
  const { data } = await axios.get(`${ML_API_URL}/items/${itemId}/visits/time_window`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { last: dias, unit: 'day' },
  });
  return data?.total_visits ?? 0;
}

export interface DetalheCategoriaML {
  id: string;
  name: string;
  path_from_root: { id: string; name: string }[];
  // Subcategorias diretas — vazio quando a categoria já é folha (não aceita
  // POST /items com este id como category_id, precisa descer mais). Usado
  // pela navegação manual em árvore (listarFilhosCategoria).
  children_categories: { id: string; name: string }[];
}

// GET /categories/{id} — nome e caminho (path_from_root) da categoria, pra
// exibir no formulário de publicação e gravar em
// mercadolivre_categorias_cache sem precisar de outra fonte pro nome.
export async function buscarCategoriaML(token: string, categoriaId: string): Promise<DetalheCategoriaML> {
  const { data } = await axios.get(`${ML_API_URL}/categories/${categoriaId}`, { headers: { Authorization: `Bearer ${token}` } });
  return data;
}

// GET /sites/{site}/categories — categorias de topo do site (raiz da árvore).
// Ponto de partida da navegação manual quando o preditor erra o domínio (ex:
// "Motos transacionais" pra uma peça avulsa) — ver EstoquePublicarMlModal.tsx.
export async function buscarCategoriasRaizML(token: string): Promise<{ id: string; name: string }[]> {
  const { data } = await axios.get(`${ML_API_URL}/sites/${SITE_ID}/categories`, { headers: { Authorization: `Bearer ${token}` } });
  return data ?? [];
}

// POST /users/test_user — cria uma conta de comprador/vendedor descartável
// pra testar o fluxo de publicação sem usar a conta real da loja (não
// existe sandbox de item no Mercado Livre — publicar de teste sem isso
// criaria um anúncio real). Só é chamada manualmente durante testes
// (Fase 8) — mesmo espírito de pausarAnuncio, "só por clique humano
// explícito", nunca em fluxo automático.
export async function criarUsuarioTesteML(token: string): Promise<{ id: number; nickname: string; password: string; site_id: string }> {
  const { data } = await axios.post(`${ML_API_URL}/users/test_user`, { site_id: SITE_ID }, { headers: { Authorization: `Bearer ${token}` } });
  return data;
}
