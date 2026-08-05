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
  buyer?: { nickname?: string };
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
