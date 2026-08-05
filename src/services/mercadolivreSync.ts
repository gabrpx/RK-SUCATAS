// Orquestração que junta o cliente puro (mercadolivreApi.ts) com as tabelas
// de domínio (estoque/vendas/promoções). Cada função aqui é chamada por uma
// rota de src/server/routes/mercadolivre.ts ou pelo detector de pendências
// em background (mercadolivreScheduler.ts).
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  extrairMlbId,
  buscarItemML,
  buscarItensPorIds,
  atualizarItemML,
  buscarItensAtivosVendedor,
  buscarPedidosRecentes,
  buscarPerguntas,
  buscarEnvio,
  obterConexaoAtual,
  type AtualizacaoItemML,
} from './mercadolivreApi.js';
import { anexarPromocoes } from '../features/promocoes/calculo.js';

const CODIGOS_MIGRATION_AUSENTE = ['42703', '42P01', 'PGRST205'];

function ehErroDeMigrationAusente(error: any): boolean {
  return !!error && CODIGOS_MIGRATION_AUSENTE.includes(error.code);
}

// ============================================================================
// Feature 1 + 7 — reconciliação manual de anúncio (quantidade + preço + status)
// ============================================================================

export interface ResultadoSincronizacao {
  sincronizado: boolean;
  motivo?: 'sem_link_valido' | 'item_nao_encontrado';
  mudouPreco?: boolean;
  mudouQuantidade?: boolean;
  mudouStatus?: boolean;
}

// Chamada só por clique humano (nunca em background) — por isso reconcilia
// nos dois sentidos, inclusive reativando um anúncio pausado se a peça
// voltou a ter estoque. A cautela de "nunca reativar sem supervisão" só se
// aplica a automação silenciosa, que este sistema não tem.
export async function sincronizarAnuncio(supabase: SupabaseClient, token: string, estoqueId: string): Promise<ResultadoSincronizacao> {
  const { data: item, error } = await supabase
    .from('estoque')
    .select('id, valor, quantidade, categoria_id, modelo_moto_id, anuncio_ml_url')
    .eq('id', estoqueId)
    .maybeSingle();
  if (error) throw error;
  if (!item) return { sincronizado: false, motivo: 'item_nao_encontrado' };

  const mlbId = extrairMlbId(item.anuncio_ml_url);
  if (!mlbId) return { sincronizado: false, motivo: 'sem_link_valido' };

  const [comPromocao] = await anexarPromocoes(supabase, [item]);
  const precoEfetivo = comPromocao.promocao_ativa?.valor_promocional ?? (Number(item.valor) || 0);
  const quantidadeAlvo = Number(item.quantidade) || 0;
  const statusAlvo: 'active' | 'paused' = quantidadeAlvo > 0 ? 'active' : 'paused';

  const atual = await buscarItemML(token, mlbId);

  const atualizacao: AtualizacaoItemML = {};
  // Compara em centavos pra não disparar PUT por ruído de ponto flutuante.
  const precoMudou = Math.round(precoEfetivo * 100) !== Math.round(Number(atual.price) * 100);
  const quantidadeMudou = Number(atual.available_quantity) !== quantidadeAlvo;
  const statusMudou = atual.status !== statusAlvo;

  if (precoMudou) atualizacao.price = precoEfetivo;
  if (quantidadeMudou) atualizacao.available_quantity = quantidadeAlvo;
  if (statusMudou) atualizacao.status = statusAlvo;

  if (Object.keys(atualizacao).length > 0) {
    await atualizarItemML(token, mlbId, atualizacao);
  }

  return { sincronizado: true, mudouPreco: precoMudou, mudouQuantidade: quantidadeMudou, mudouStatus: statusMudou };
}

export interface ResultadoReconciliacao {
  verificados: number;
  sincronizados: number;
  ignorados: number;
  erros: { estoqueId: string; nome: string; error: string }[];
}

export async function reconciliarCatalogoCompleto(supabase: SupabaseClient, token: string): Promise<ResultadoReconciliacao> {
  const { data: itens, error } = await supabase.from('estoque').select('id, nome').not('anuncio_ml_url', 'is', null);
  if (error) throw error;

  const resultado: ResultadoReconciliacao = { verificados: 0, sincronizados: 0, ignorados: 0, erros: [] };

  // Loop sequencial, não Promise.all — mesmo estilo pragmático do
  // vender-tudo em orcamentos.ts. Uma falha isolada (ex: anúncio removido no
  // ML) não deve interromper a reconciliação do resto do catálogo.
  for (const item of itens ?? []) {
    resultado.verificados++;
    try {
      const r = await sincronizarAnuncio(supabase, token, item.id);
      if (r.sincronizado) resultado.sincronizados++;
      else resultado.ignorados++;
    } catch (err: any) {
      resultado.erros.push({ estoqueId: item.id, nome: item.nome, error: err.response?.data?.message || err.message });
    }
  }

  return resultado;
}

// ============================================================================
// Mapa local peça-por-mlbId — base da feature 2 (importar pedido) e feature 3
// (rascunho de resposta), sempre lido fresco (nunca cacheado) pra nunca casar
// um pedido novo com um preço/estoque velho.
// ============================================================================

interface EstoqueResumoML {
  id: string;
  nome: string;
  valor: number;
  quantidade: number;
  condicao: string;
  ano: string | null;
  modeloMotoNome: string | null;
}

async function construirMapaEstoquePorMlb(supabase: SupabaseClient): Promise<Map<string, EstoqueResumoML>> {
  // !estoque_modelo_moto_id_fkey desambigua a FK — mesma necessidade de
  // src/server/routes/estoque.ts desde que estoque_modelos_compativeis
  // (migration_019) criou um segundo caminho N:N até modelos_moto.
  const { data } = await supabase
    .from('estoque')
    .select('id, nome, valor, quantidade, condicao, ano, anuncio_ml_url, modelo_moto:modelos_moto!estoque_modelo_moto_id_fkey(nome)')
    .not('anuncio_ml_url', 'is', null);

  const mapa = new Map<string, EstoqueResumoML>();
  for (const item of data ?? []) {
    const mlbId = extrairMlbId(item.anuncio_ml_url);
    if (!mlbId) continue;
    mapa.set(mlbId, {
      id: item.id,
      nome: item.nome,
      valor: Number(item.valor) || 0,
      quantidade: Number(item.quantidade) || 0,
      condicao: item.condicao,
      ano: item.ano ?? null,
      modeloMotoNome: (item.modelo_moto as any)?.nome ?? null,
    });
  }
  return mapa;
}

// ============================================================================
// Feature 2 — preview + importação de pedidos como venda
// ============================================================================

export type StatusItemPedido = 'encontrado' | 'nao_encontrado' | 'ja_importado';

export interface ItemPedidoPreview {
  mlItemId: string;
  titulo: string;
  quantidade: number;
  valorUnitario: number;
  status: StatusItemPedido;
  estoqueIdSugerido: string | null;
  estoqueNomeSugerido: string | null;
}

export interface PedidoPreview {
  mlOrderId: string;
  dataCriacao: string;
  comprador: string | null;
  shippingId: string | null;
  itens: ItemPedidoPreview[];
}

async function buscarVendasJaImportadas(supabase: SupabaseClient, mlOrderIds: string[]): Promise<Set<string>> {
  if (mlOrderIds.length === 0) return new Set();
  const { data, error } = await supabase.from('vendas').select('ml_order_id, ml_item_id').in('ml_order_id', mlOrderIds);
  if (error) {
    if (ehErroDeMigrationAusente(error)) {
      throw new Error('Rode a migration_022 antes de importar pedidos do Mercado Livre.');
    }
    throw error;
  }
  return new Set((data ?? []).map((v) => `${v.ml_order_id}::${v.ml_item_id}`));
}

export async function buscarPreviewPedidos(supabase: SupabaseClient, token: string, mlUserId: string, dias: number): Promise<PedidoPreview[]> {
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  const [pedidos, mapaEstoque] = await Promise.all([buscarPedidosRecentes(token, mlUserId, desde), construirMapaEstoquePorMlb(supabase)]);
  if (pedidos.length === 0) return [];

  const jaImportados = await buscarVendasJaImportadas(supabase, pedidos.map((p) => String(p.id)));

  return pedidos.map((pedido) => ({
    mlOrderId: String(pedido.id),
    dataCriacao: pedido.date_created,
    comprador: pedido.buyer?.nickname ?? null,
    shippingId: pedido.shipping?.id ? String(pedido.shipping.id) : null,
    itens: pedido.order_items.map((linha): ItemPedidoPreview => {
      const chave = `${pedido.id}::${linha.item.id}`;
      const match = mapaEstoque.get(linha.item.id);
      return {
        mlItemId: linha.item.id,
        titulo: linha.item.title,
        quantidade: linha.quantity,
        valorUnitario: linha.unit_price,
        status: jaImportados.has(chave) ? 'ja_importado' : match ? 'encontrado' : 'nao_encontrado',
        estoqueIdSugerido: match?.id ?? null,
        estoqueNomeSugerido: match?.nome ?? null,
      };
    }),
  }));
}

export interface ImportarPedidoParams {
  estoqueId: string;
  quantidade: number;
  valorUnitario: number;
  formaPagamentoId: string;
  clienteNome: string | null;
  data: string | null;
  mlOrderId: string;
  mlItemId: string;
  mlShippingId: string | null;
}

// Retorna null (não erro) quando o item já tinha sido importado antes — o
// índice único de (ml_order_id, ml_item_id) é o backstop final contra
// duplo-clique, mas esse pré-check evita bater a RPC sem necessidade na
// maioria dos casos.
export async function importarPedidoComoVenda(supabase: SupabaseClient, params: ImportarPedidoParams) {
  const { data: existente, error: erroDedup } = await supabase
    .from('vendas')
    .select('id')
    .eq('ml_order_id', params.mlOrderId)
    .eq('ml_item_id', params.mlItemId)
    .maybeSingle();
  if (erroDedup) {
    if (ehErroDeMigrationAusente(erroDedup)) throw new Error('Rode a migration_022 antes de importar pedidos do Mercado Livre.');
    throw erroDedup;
  }
  if (existente) return null;

  const { data: venda, error } = await supabase.rpc('registrar_venda', {
    p_estoque_id: params.estoqueId,
    p_quantidade: params.quantidade,
    p_valor_unitario: params.valorUnitario,
    p_forma_pagamento_id: params.formaPagamentoId,
    p_modelo_moto_id: null,
    p_cliente_nome: params.clienteNome,
    p_observacoes: `Importado do Mercado Livre — pedido ${params.mlOrderId}`,
    p_data: params.data,
  });
  if (error) throw error;

  const { error: erroUpdate } = await supabase
    .from('vendas')
    .update({ canal: 'mercado_livre', ml_order_id: params.mlOrderId, ml_item_id: params.mlItemId, ml_shipping_id: params.mlShippingId })
    .eq('id', venda.id);
  if (erroUpdate) throw erroUpdate;

  return venda;
}

export interface ImportarPedidosResultado {
  sucesso: number;
  pulados: number;
  falhas: { mlOrderId: string; mlItemId: string; error: string }[];
}

export async function importarPedidosEmLote(supabase: SupabaseClient, itens: ImportarPedidoParams[]): Promise<ImportarPedidosResultado> {
  const resultado: ImportarPedidosResultado = { sucesso: 0, pulados: 0, falhas: [] };

  for (const item of itens) {
    try {
      const venda = await importarPedidoComoVenda(supabase, item);
      if (venda) resultado.sucesso++;
      else resultado.pulados++;
    } catch (err: any) {
      resultado.falhas.push({ mlOrderId: item.mlOrderId, mlItemId: item.mlItemId, error: err.message });
    }
  }

  return resultado;
}

// ============================================================================
// Feature 10 — dados de envio (Mercado Envios) de um pedido já importado
// ============================================================================

export async function buscarEnvioDoPedido(supabase: SupabaseClient, token: string, mlOrderId: string) {
  const { data: venda, error } = await supabase.from('vendas').select('ml_shipping_id').eq('ml_order_id', mlOrderId).limit(1).maybeSingle();
  if (error) {
    if (ehErroDeMigrationAusente(error)) throw new Error('Rode a migration_022 antes de consultar envios do Mercado Livre.');
    throw error;
  }
  // null = retirada em loja (o comprador optou por buscar no balcão) — não é erro.
  if (!venda?.ml_shipping_id) return null;

  return buscarEnvio(token, venda.ml_shipping_id);
}

// ============================================================================
// Feature 3 — perguntas com rascunho de resposta
// ============================================================================

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function montarRascunhoResposta(item: EstoqueResumoML): string {
  const condicaoTexto = item.condicao === 'original' ? 'original' : 'paralela';
  const modeloTexto = item.modeloMotoNome ? ` pra ${item.modeloMotoNome}${item.ano ? ` (${item.ano})` : ''}` : '';
  const disponibilidade = item.quantidade > 0 ? `Temos ${item.quantidade} unidade(s) em estoque.` : 'No momento está em falta, mas pode chegar em breve.';
  return `Olá! Essa peça é ${condicaoTexto}${modeloTexto}, no valor de ${formatarMoeda(item.valor)}. ${disponibilidade}`;
}

export interface PerguntaPreview {
  id: number;
  itemId: string;
  texto: string;
  dataCriacao: string;
  rascunhoResposta: string | null;
}

export async function buscarPerguntasComRascunho(supabase: SupabaseClient, token: string, mlUserId: string): Promise<PerguntaPreview[]> {
  const [perguntas, mapaEstoque] = await Promise.all([buscarPerguntas(token, mlUserId, 'UNANSWERED'), construirMapaEstoquePorMlb(supabase)]);

  return perguntas.map((pergunta) => {
    const item = mapaEstoque.get(pergunta.item_id);
    return {
      id: pergunta.id,
      itemId: pergunta.item_id,
      texto: pergunta.text,
      dataCriacao: pergunta.date_created,
      rascunhoResposta: item ? montarRascunhoResposta(item) : null,
    };
  });
}

// ============================================================================
// Feature 6 — anúncios ativos no ML sem peça local correspondente
// ============================================================================

export interface AnuncioOrfaoML {
  mlbId: string;
  titulo: string;
  preco: number;
  permalink: string;
  thumbnail: string | null;
  quantidadeDisponivel: number;
}

export async function listarAnunciosOrfaos(supabase: SupabaseClient, token: string, mlUserId: string): Promise<AnuncioOrfaoML[]> {
  const [idsAtivos, mapaEstoque] = await Promise.all([buscarItensAtivosVendedor(token, mlUserId), construirMapaEstoquePorMlb(supabase)]);
  if (idsAtivos.length === 0) return [];

  const idsOrfaos = idsAtivos.filter((id) => !mapaEstoque.has(id));
  if (idsOrfaos.length === 0) return [];

  const detalhes = await buscarItensPorIds(token, idsOrfaos);
  return detalhes.map((item) => ({
    mlbId: item.id,
    titulo: item.title,
    preco: item.price,
    permalink: item.permalink,
    thumbnail: item.thumbnail ?? null,
    quantidadeDisponivel: item.available_quantity,
  }));
}

// ============================================================================
// Feature 9 — detecção de pendências (usada pelo scheduler e pelo indicador
// ao vivo da tela). Nunca escreve em vendas/estoque/ML — só lê e loga.
// ============================================================================

export interface ContagemPendencias {
  perguntasSemResposta: number;
  pedidosNovos: number;
}

export async function contarPendencias(supabase: SupabaseClient, token: string, mlUserId: string): Promise<ContagemPendencias> {
  const [perguntas, pedidos] = await Promise.all([buscarPerguntas(token, mlUserId, 'UNANSWERED'), buscarPreviewPedidos(supabase, token, mlUserId, 30)]);
  const pedidosPendentes = pedidos.filter((p) => p.itens.some((i) => i.status !== 'ja_importado'));
  return { perguntasSemResposta: perguntas.length, pedidosNovos: pedidosPendentes.length };
}

// Roda em background (mercadolivreScheduler.ts): grava um sinal leve de
// "chegou pedido/pergunta novo" pra tabela auxiliar mercadolivre_notificacoes.
// Puramente informativo — nunca grava venda nem muda anúncio no ML.
export async function verificarNotificacoesPendentes(supabase: SupabaseClient): Promise<void> {
  const conexao = await obterConexaoAtual(supabase);
  if (!conexao) return; // ninguém conectou a conta ainda — nada a verificar

  const doisDiasAtras = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

  const [pedidos, perguntas] = await Promise.all([
    buscarPedidosRecentes(conexao.accessToken, conexao.mlUserId, doisDiasAtras).catch((err) => {
      console.error('Erro ao verificar pedidos pendentes do Mercado Livre:', err.response?.data || err.message);
      return [];
    }),
    buscarPerguntas(conexao.accessToken, conexao.mlUserId, 'UNANSWERED').catch((err) => {
      console.error('Erro ao verificar perguntas pendentes do Mercado Livre:', err.response?.data || err.message);
      return [];
    }),
  ]);

  const linhas = [
    ...pedidos.map((p) => ({ topic: 'orders_v2', resource: `/orders/${p.id}`, ml_user_id: conexao.mlUserId, origem: 'polling' as const })),
    ...perguntas.map((q) => ({ topic: 'questions', resource: `/questions/${q.id}`, ml_user_id: conexao.mlUserId, origem: 'polling' as const })),
  ];
  if (linhas.length === 0) return;

  const { error } = await supabase.from('mercadolivre_notificacoes').upsert(linhas, { onConflict: 'topic,resource', ignoreDuplicates: true });
  if (error && !ehErroDeMigrationAusente(error)) {
    console.error('Erro ao registrar notificações pendentes do Mercado Livre:', error);
  }
}
