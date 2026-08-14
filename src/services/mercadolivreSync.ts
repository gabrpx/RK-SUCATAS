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
  buscarPedido,
  buscarPerguntas,
  buscarEnvio,
  obterConexaoAtual,
  obterMargemSincronizacao,
  type AtualizacaoItemML,
} from './mercadolivreApi.js';
import { anexarPromocoes } from '../features/promocoes/calculo.js';
import { tokenizar, similaridade, CORTE_POSSIVEL } from '../features/estoque/detectarDuplicata.js';
import { notificarUsuarios } from './pushNotificationService.js';
import { buscarDestinatariosEquipe } from './destinatariosNotificacao.js';

// 42703 = coluna indefinida no Postgres; 42P01 = tabela indefinida;
// PGRST204/PGRST205 = coluna/tabela fora do cache de schema do PostgREST.
const CODIGOS_MIGRATION_AUSENTE = ['42703', '42P01', 'PGRST204', 'PGRST205'];

function ehErroDeMigrationAusente(error: any): boolean {
  return !!error && CODIGOS_MIGRATION_AUSENTE.includes(error.code);
}

// ============================================================================
// Feature 1 + 7 — sincronização de anúncio (preço, quantidade, status), com
// revisão explícita: preview calcula tudo sem escrever nada, apply escreve
// só o que foi selecionado. Nunca roda em background — só por clique humano.
// ============================================================================

interface LinkParaSincronizar {
  linkId: string;
  estoqueId: string;
  estoqueNome: string;
  estoqueValor: number;
  estoqueQuantidade: number;
  estoqueCategoriaId: string | null;
  estoqueModeloMotoId: string | null;
  mlbId: string;
  url: string;
}

const SELECT_ESTOQUE_SYNC = 'id, nome, valor, quantidade, categoria_id, modelo_moto_id';

function linkDoItemLegado(item: any): LinkParaSincronizar | null {
  const mlbId = extrairMlbId(item.anuncio_ml_url);
  if (!mlbId) return null;
  return {
    linkId: `legado:${item.id}`,
    estoqueId: item.id,
    estoqueNome: item.nome,
    estoqueValor: Number(item.valor) || 0,
    estoqueQuantidade: Number(item.quantidade) || 0,
    estoqueCategoriaId: item.categoria_id,
    estoqueModeloMotoId: item.modelo_moto_id,
    mlbId,
    url: item.anuncio_ml_url,
  };
}

// Todo vínculo elegível pra sincronizar, já resolvendo o fallback de
// migração pendente (tabela ausente → sintetiza a partir do link único
// legado, mesma lógica de anexarAnunciosMl em src/server/routes/estoque.ts).
async function buscarLinksParaSincronizar(supabase: SupabaseClient, filtroLinkIds?: string[]): Promise<LinkParaSincronizar[]> {
  const { data, error } = await supabase.from('estoque_anuncios_ml').select(`id, url, mlb_id, estoque:estoque(${SELECT_ESTOQUE_SYNC})`);

  let links: LinkParaSincronizar[];
  if (error) {
    if (!ehErroDeMigrationAusente(error)) throw error;
    const { data: itens, error: erroLegado } = await supabase.from('estoque').select(`${SELECT_ESTOQUE_SYNC}, anuncio_ml_url`).not('anuncio_ml_url', 'is', null);
    if (erroLegado) throw erroLegado;
    links = (itens ?? []).map(linkDoItemLegado).filter((l): l is LinkParaSincronizar => l !== null);
  } else {
    links = (data ?? [])
      .filter((link: any) => !!link.estoque)
      .map((link: any) => ({
        linkId: link.id,
        estoqueId: link.estoque.id,
        estoqueNome: link.estoque.nome,
        estoqueValor: Number(link.estoque.valor) || 0,
        estoqueQuantidade: Number(link.estoque.quantidade) || 0,
        estoqueCategoriaId: link.estoque.categoria_id,
        estoqueModeloMotoId: link.estoque.modelo_moto_id,
        mlbId: link.mlb_id,
        url: link.url,
      }));
  }

  if (!filtroLinkIds) return links;
  const filtro = new Set(filtroLinkIds);
  return links.filter((l) => filtro.has(l.linkId));
}

function arredondarCentavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export interface AnuncioParaSincronizar {
  linkId: string;
  estoqueId: string;
  estoqueNome: string;
  mlbId: string;
  url: string;
  // false = o anúncio não veio no lote de buscarItensPorIds (removido/inacessível no ML).
  disponivelNoMl: boolean;
  // status 'closed' no ML — não dá pra reativar via PUT simples de status.
  fechado: boolean;
  precoAtualMl: number | null;
  quantidadeAtualMl: number | null;
  statusAtualMl: string | null;
  precoEfetivoSistema: number; // já com promoção, ANTES da margem
  margemAplicada: number;
  precoNovoSistema: number; // precoEfetivoSistema * (1 + margem/100)
  quantidadeNovaSistema: number;
  statusNovoSistema: 'active' | 'paused';
  mudaPreco: boolean;
  mudaQuantidade: boolean;
  mudaStatus: boolean;
  semAlteracao: boolean;
}

// Núcleo compartilhado por preview e apply — sempre recalcula do zero em vez
// de confiar num preview antigo do cliente (mesma cautela de
// importarPedidoComoVenda, que re-checa duplicidade antes da RPC).
async function calcularAnunciosParaSincronizar(
  supabase: SupabaseClient,
  token: string,
  filtroLinkIds?: string[]
): Promise<{ margemPercentual: number; anuncios: AnuncioParaSincronizar[] }> {
  const [links, margemPercentual] = await Promise.all([buscarLinksParaSincronizar(supabase, filtroLinkIds), obterMargemSincronizacao(supabase)]);
  if (links.length === 0) return { margemPercentual, anuncios: [] };

  // Preço efetivo (com promoção) calculado 1x por peça — várias linhas
  // (item com 2+ anúncios) não devem chamar anexarPromocoes repetido.
  const itensUnicos = new Map<string, LinkParaSincronizar>();
  for (const link of links) if (!itensUnicos.has(link.estoqueId)) itensUnicos.set(link.estoqueId, link);
  const comPromocao = await anexarPromocoes(
    supabase,
    Array.from(itensUnicos.values()).map((l) => ({ id: l.estoqueId, valor: l.estoqueValor, quantidade: l.estoqueQuantidade, categoria_id: l.estoqueCategoriaId, modelo_moto_id: l.estoqueModeloMotoId }))
  );
  const precoEfetivoPorItem = new Map<string, number>();
  for (const item of comPromocao as any[]) precoEfetivoPorItem.set(item.id, item.promocao_ativa?.valor_promocional ?? (Number(item.valor) || 0));

  const itensMl = await buscarItensPorIds(token, links.map((l) => l.mlbId));
  const mapaMl = new Map<string, any>();
  for (const item of itensMl) mapaMl.set(item.id, item);

  const anuncios = links.map((link): AnuncioParaSincronizar => {
    const itemMl = mapaMl.get(link.mlbId);
    const disponivelNoMl = !!itemMl;
    const fechado = disponivelNoMl && itemMl.status === 'closed';
    const precoEfetivoSistema = precoEfetivoPorItem.get(link.estoqueId) ?? link.estoqueValor;
    const precoNovoSistema = arredondarCentavos(precoEfetivoSistema * (1 + margemPercentual / 100));
    const quantidadeNovaSistema = link.estoqueQuantidade;
    const statusNovoSistema: 'active' | 'paused' = quantidadeNovaSistema > 0 ? 'active' : 'paused';

    const precoAtualMl = disponivelNoMl ? Number(itemMl.price) : null;
    const quantidadeAtualMl = disponivelNoMl ? Number(itemMl.available_quantity) : null;
    const statusAtualMl = disponivelNoMl ? itemMl.status : null;

    // Compara em centavos pra não disparar PUT por ruído de ponto flutuante.
    const mudaPreco = disponivelNoMl && Math.round(precoNovoSistema * 100) !== Math.round((precoAtualMl ?? 0) * 100);
    const mudaQuantidade = disponivelNoMl && quantidadeAtualMl !== quantidadeNovaSistema;
    const mudaStatus = disponivelNoMl && !fechado && statusAtualMl !== statusNovoSistema;

    return {
      linkId: link.linkId,
      estoqueId: link.estoqueId,
      estoqueNome: link.estoqueNome,
      mlbId: link.mlbId,
      url: link.url,
      disponivelNoMl,
      fechado,
      precoAtualMl,
      quantidadeAtualMl,
      statusAtualMl,
      precoEfetivoSistema,
      margemAplicada: margemPercentual,
      precoNovoSistema,
      quantidadeNovaSistema,
      statusNovoSistema,
      mudaPreco,
      mudaQuantidade,
      mudaStatus,
      semAlteracao: disponivelNoMl && !mudaPreco && !mudaQuantidade && !mudaStatus,
    };
  });

  return { margemPercentual, anuncios };
}

export interface PreviewSincronizacao {
  margemPercentual: number;
  anuncios: AnuncioParaSincronizar[];
}

export async function buscarPreviewSincronizacao(supabase: SupabaseClient, token: string): Promise<PreviewSincronizacao> {
  return calcularAnunciosParaSincronizar(supabase, token);
}

export interface AplicarSincronizacaoResultado {
  processados: number;
  sincronizados: number;
  semAlteracao: number;
  indisponiveis: number;
  erros: { linkId: string; estoqueNome: string; mlbId: string; error: string }[];
}

export async function aplicarSincronizacao(supabase: SupabaseClient, token: string, linkIds: string[]): Promise<AplicarSincronizacaoResultado> {
  const { anuncios } = await calcularAnunciosParaSincronizar(supabase, token, linkIds);

  const resultado: AplicarSincronizacaoResultado = { processados: 0, sincronizados: 0, semAlteracao: 0, indisponiveis: 0, erros: [] };

  // Loop sequencial, não Promise.all — mesmo estilo pragmático do resto
  // deste arquivo. Uma falha isolada (ex: anúncio removido no ML entre o
  // preview e agora) não deve travar o restante da seleção.
  for (const anuncio of anuncios) {
    resultado.processados++;
    if (!anuncio.disponivelNoMl) {
      resultado.indisponiveis++;
      continue;
    }
    if (anuncio.semAlteracao) {
      resultado.semAlteracao++;
      continue;
    }
    try {
      const atualizacao: AtualizacaoItemML = {};
      if (anuncio.mudaPreco) atualizacao.price = anuncio.precoNovoSistema;
      if (anuncio.mudaQuantidade) atualizacao.available_quantity = anuncio.quantidadeNovaSistema;
      if (anuncio.mudaStatus) atualizacao.status = anuncio.statusNovoSistema;
      if (Object.keys(atualizacao).length > 0) await atualizarItemML(token, anuncio.mlbId, atualizacao);
      resultado.sincronizados++;
    } catch (err: any) {
      resultado.erros.push({ linkId: anuncio.linkId, estoqueNome: anuncio.estoqueNome, mlbId: anuncio.mlbId, error: err.response?.data?.message || err.message });
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

// !estoque_modelo_moto_id_fkey desambigua a FK — mesma necessidade de
// src/server/routes/estoque.ts desde que estoque_modelos_compativeis
// (migration_019) criou um segundo caminho N:N até modelos_moto.
const SELECT_ESTOQUE_RESUMO = 'id, nome, valor, quantidade, condicao, ano, modelo_moto:modelos_moto!estoque_modelo_moto_id_fkey(nome)';

function resumirEstoqueML(item: any): EstoqueResumoML {
  return {
    id: item.id,
    nome: item.nome,
    valor: Number(item.valor) || 0,
    quantidade: Number(item.quantidade) || 0,
    condicao: item.condicao,
    ano: item.ano ?? null,
    modeloMotoNome: (item.modelo_moto as any)?.nome ?? null,
  };
}

// Lê estoque_anuncios_ml (migration_025), com o mesmo fallback de migração
// pendente do resto do arquivo: se a tabela ainda não existir, cai pro link
// único legado (anuncio_ml_url) — pedidos/perguntas continuam funcionando
// idênticos a antes desta feature, só passam a enxergar todos os N links
// por peça depois que a migração rodar.
async function construirMapaEstoquePorMlb(supabase: SupabaseClient): Promise<Map<string, EstoqueResumoML>> {
  const { data, error } = await supabase.from('estoque_anuncios_ml').select(`mlb_id, estoque:estoque(${SELECT_ESTOQUE_RESUMO})`);

  const mapa = new Map<string, EstoqueResumoML>();

  if (error) {
    if (!ehErroDeMigrationAusente(error)) throw error;
    const { data: itens } = await supabase.from('estoque').select(`${SELECT_ESTOQUE_RESUMO}, anuncio_ml_url`).not('anuncio_ml_url', 'is', null);
    for (const item of itens ?? []) {
      const mlbId = extrairMlbId((item as any).anuncio_ml_url);
      if (!mlbId) continue;
      mapa.set(mlbId, resumirEstoqueML(item));
    }
    return mapa;
  }

  for (const link of data ?? []) {
    if (!(link as any).estoque) continue;
    mapa.set((link as any).mlb_id, resumirEstoqueML((link as any).estoque));
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
    compradorMlId: pedido.buyer?.id ?? null,
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
  clienteId?: string | null;
  data: string | null;
  mlOrderId: string;
  mlItemId: string;
  mlShippingId: string | null;
  // Ficha específica (estoque_unidades) quando o pedido é de uma VARIAÇÃO —
  // sem isso a venda sai da peça-mãe e ninguém sabe qual unidade saiu.
  unidadeId?: string | null;
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
    p_cliente_id: params.clienteId || null,
    p_unidade_id: params.unidadeId || null,
  });
  if (error) throw error;

  const { error: erroUpdate } = await supabase
    .from('vendas')
    .update({ canal: 'mercado_livre', ml_order_id: params.mlOrderId, ml_item_id: params.mlItemId, ml_shipping_id: params.mlShippingId })
    .eq('id', venda.id);
  // DELIBERADO: este erro NÃO passa por ehErroDeMigrationAusente e sobe cru —
  // sem ml_order_id gravado a venda fica invisível pra dedupe, e engolir isso
  // transformaria o buraco em silêncio.
  //
  // Também deliberado: `naoRetentar`. A RPC já rodou e o estoque já foi
  // decrementado; como o índice único não protege (NULL não colide no
  // Postgres), retentar registraria uma SEGUNDA venda com SEGUNDA baixa. Quem
  // consome a fila marca a linha processada com este erro preservado — trocar
  // "duplicar venda" por "um humano precisa olhar" é a política do módulo.
  if (erroUpdate) throw Object.assign(new Error(erroUpdate.message ?? String(erroUpdate)), { naoRetentar: true, causa: erroUpdate });

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
// Feature 6 — anúncios ativos no ML sem peça local correspondente, com
// sugestão de vínculo por título parecido (fuzzy match)
// ============================================================================

export interface AnuncioOrfaoML {
  mlbId: string;
  titulo: string;
  preco: number;
  permalink: string;
  thumbnail: string | null;
  quantidadeDisponivel: number;
  sugestao: { estoqueId: string; nome: string; similaridade: number } | null;
}

interface CandidatoSugestao {
  id: string;
  nome: string;
  tokens: string[];
}

async function buscarCandidatosSugestao(supabase: SupabaseClient): Promise<CandidatoSugestao[]> {
  const { data } = await supabase.from('estoque').select('id, nome').eq('ativo', true);
  return (data ?? []).map((item) => ({ id: item.id, nome: item.nome, tokens: tokenizar(item.nome) }));
}

// Melhor peça do estoque candidata a ser este anúncio — mesmo corte/critério
// de detectarDuplicatas (Jaccard sobre tokens), aplicado agora contra título
// de anúncio em vez de nome digitado.
function sugerirEstoquePorTitulo(titulo: string, candidatos: CandidatoSugestao[]): AnuncioOrfaoML['sugestao'] {
  const tokensAnuncio = tokenizar(titulo);
  if (tokensAnuncio.length === 0) return null;

  let melhor: AnuncioOrfaoML['sugestao'] = null;
  for (const candidato of candidatos) {
    const score = similaridade(tokensAnuncio, candidato.tokens);
    if (score < CORTE_POSSIVEL) continue;
    if (!melhor || score > melhor.similaridade) melhor = { estoqueId: candidato.id, nome: candidato.nome, similaridade: score };
  }
  return melhor;
}

export async function listarAnunciosOrfaos(supabase: SupabaseClient, token: string, mlUserId: string): Promise<AnuncioOrfaoML[]> {
  const [idsAtivos, mapaEstoque] = await Promise.all([buscarItensAtivosVendedor(token, mlUserId), construirMapaEstoquePorMlb(supabase)]);
  if (idsAtivos.length === 0) return [];

  const idsOrfaos = idsAtivos.filter((id) => !mapaEstoque.has(id));
  if (idsOrfaos.length === 0) return [];

  const [detalhes, candidatos] = await Promise.all([buscarItensPorIds(token, idsOrfaos), buscarCandidatosSugestao(supabase)]);
  return detalhes.map((item) => ({
    mlbId: item.id,
    titulo: item.title,
    preco: item.price,
    permalink: item.permalink,
    thumbnail: item.thumbnail ?? null,
    quantidadeDisponivel: item.available_quantity,
    sugestao: sugerirEstoquePorTitulo(item.title, candidatos),
  }));
}

// ============================================================================
// Feature C — anúncios duplicados no próprio catálogo do ML (títulos
// parecidos entre si, não contra o estoque — isso é a Feature 6 acima).
// ============================================================================

// Acima disso o O(n²) de comparação par-a-par fica caro demais pra rodar no
// clique — catálogo desse tamanho é sinal de que vale rodar fora do horário
// de pico, não de que o corte esteja errado.
const LIMITE_ITENS_DUPLICATAS = 500;

export interface ItemAnuncioDuplicado {
  mlbId: string;
  titulo: string;
  preco: number;
  permalink: string;
  thumbnail: string | null;
  quantidadeDisponivel: number;
  status: string;
  vinculado: boolean;
}

export interface GrupoAnuncioDuplicado {
  grupoId: string;
  itens: ItemAnuncioDuplicado[];
  similaridadeMinima: number;
}

export async function listarAnunciosDuplicados(supabase: SupabaseClient, token: string, mlUserId: string): Promise<GrupoAnuncioDuplicado[]> {
  const [idsAtivos, mapaEstoque] = await Promise.all([buscarItensAtivosVendedor(token, mlUserId), construirMapaEstoquePorMlb(supabase)]);
  if (idsAtivos.length === 0) return [];
  if (idsAtivos.length > LIMITE_ITENS_DUPLICATAS) {
    throw new Error(`Catálogo com ${idsAtivos.length} anúncios ativos — a checagem de duplicatas só roda até ${LIMITE_ITENS_DUPLICATAS} de uma vez.`);
  }

  const detalhes = await buscarItensPorIds(token, idsAtivos);
  const tokensPorIndice = detalhes.map((item) => tokenizar(item.title));

  // Union-find simples: cada anúncio começa no seu próprio grupo; todo par
  // com similaridade >= corte funde os dois grupos. Path compression só na
  // leitura (encontrar), sem rank — catálogo pequeno, não precisa mais que isso.
  const pai = detalhes.map((_, i) => i);
  function encontrar(i: number): number {
    while (pai[i] !== i) {
      pai[i] = pai[pai[i]];
      i = pai[i];
    }
    return i;
  }
  function unir(a: number, b: number) {
    const raizA = encontrar(a);
    const raizB = encontrar(b);
    if (raizA !== raizB) pai[raizB] = raizA;
  }

  const paresValidos: { i: number; score: number }[] = [];
  for (let i = 0; i < detalhes.length; i++) {
    for (let j = i + 1; j < detalhes.length; j++) {
      const score = similaridade(tokensPorIndice[i], tokensPorIndice[j]);
      if (score < CORTE_POSSIVEL) continue;
      unir(i, j);
      paresValidos.push({ i, score });
    }
  }

  const indicesPorRaiz = new Map<number, number[]>();
  for (let i = 0; i < detalhes.length; i++) {
    const raiz = encontrar(i);
    const grupo = indicesPorRaiz.get(raiz) ?? [];
    grupo.push(i);
    indicesPorRaiz.set(raiz, grupo);
  }

  // Menor score dentre os pares que efetivamente uniram o grupo — não é a
  // similaridade de TODOS os pares do grupo (que pode incluir pares
  // transitivos abaixo do corte), é "o elo mais fraco que ainda assim bateu
  // o corte".
  const minimoPorRaiz = new Map<number, number>();
  for (const { i, score } of paresValidos) {
    const raiz = encontrar(i);
    const atual = minimoPorRaiz.get(raiz);
    if (atual === undefined || score < atual) minimoPorRaiz.set(raiz, score);
  }

  const grupos: GrupoAnuncioDuplicado[] = [];
  for (const [raiz, indices] of indicesPorRaiz) {
    if (indices.length < 2) continue; // sozinho no grupo = não é duplicata
    const itens = indices.map((idx): ItemAnuncioDuplicado => {
      const item = detalhes[idx];
      return {
        mlbId: item.id,
        titulo: item.title,
        preco: item.price,
        permalink: item.permalink,
        thumbnail: item.thumbnail ?? null,
        quantidadeDisponivel: item.available_quantity,
        status: item.status,
        vinculado: mapaEstoque.has(item.id),
      };
    });
    grupos.push({ grupoId: detalhes[indices[0]].id, itens, similaridadeMinima: minimoPorRaiz.get(raiz) ?? CORTE_POSSIVEL });
  }

  return grupos.sort((a, b) => b.similaridadeMinima - a.similaridadeMinima);
}

// Chamada só por clique humano explícito (com confirmação no frontend),
// nunca em lote automático — pausar o anúncio errado por engano tira a peça
// de venda até alguém notar. Mesmo PUT parcial de atualizarItemML já usado
// pela sincronização de preço/estoque, só que forçando o status.
export async function pausarAnuncio(token: string, mlbId: string): Promise<void> {
  return atualizarItemML(token, mlbId, { status: 'paused' });
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

// ============================================================================
// Fila de pedidos (migration_044) — pedido pago no ML vira venda com baixa de
// estoque, sem clique humano. É a ÚNICA automação de escrita deste módulo, e
// ela escreve só em tabela nossa: nada aqui muta anúncio no Mercado Livre
// (isso continua exigindo revisão com checkbox, ver aplicarSincronizacao).
//
// Webhook e polling já escrevem em mercadolivre_notificacoes com índice único
// por (topic, resource) — as duas fontes convergem numa linha só, e este é o
// único consumidor.
// ============================================================================

const MAX_TENTATIVAS_PEDIDO = 5;
const PEDIDOS_POR_CICLO = 20;

// Status do pedido no ML que NÃO vão mudar mais: podem ser descartados da fila
// na primeira visita. Qualquer outro status diferente de 'paid' é TRANSITÓRIO
// (pix atrasado, boleto, análise de fraude) e o pedido ainda pode ser pago.
//
// Isto é crítico: o webhook enfileira a notificação do pedido recém-criado,
// que quase sempre chega antes do pagamento aprovar. Marcar processado aí
// perderia a venda pra sempre, porque a segunda notificação do MESMO resource
// bate no upsert `ignoreDuplicates` (ON CONFLICT DO NOTHING) e não reabre a
// linha existente.
const STATUS_TERMINAIS_PEDIDO = ['cancelled', 'invalid'];
// Teto pro pedido transitório não virar linha eterna (checkout abandonado):
// depois disso a fila desiste e grava o motivo.
const DIAS_ESPERA_PAGAMENTO = 7;

export interface ResultadoFilaPedidos {
  importados: number;
  itensImportados: { estoqueNome: string; mlOrderId: string }[];
  // `motivo` sobrescreve o texto padrão do push quando o caso precisa de
  // explicação própria (ex.: duas unidades do mesmo anúncio no mesmo pedido).
  semMatch: { mlOrderId: string; titulo: string; motivo?: string }[];
  ignorados: number;
  // Pedido ainda não pago que continua na fila — não é falha nem ignorado.
  aguardandoPagamento: number;
  falhas: number;
  // Linhas que esgotaram MAX_TENTATIVAS_PEDIDO: venda real do ML que o sistema
  // decidiu DEFINITIVAMENTE não registrar. Precisa virar push, senão o único
  // rastro é uma linha de log num servidor que hiberna.
  abandonados: { mlOrderId: string; erro: string }[];
}

// A forma de pagamento dedicada é seed da migration_044. Ausente = migração
// não rodou: melhor não importar nada do que empurrar as vendas do canal ML
// pra uma forma de pagamento arbitrária e sujar o caixa.
async function obterFormaPagamentoMercadoLivre(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.from('formas_pagamento').select('id').eq('nome', 'MERCADO LIVRE').maybeSingle();
  if (error) {
    if (ehErroDeMigrationAusente(error)) return null;
    throw error;
  }
  return data?.id ?? null;
}

function extrairOrderId(resource: string): string | null {
  return resource.match(/\/orders\/(\d+)/)?.[1] ?? null;
}

function ehErroDeEstoqueInsuficiente(mensagem: string): boolean {
  return /estoque insuficiente/i.test(mensagem);
}

// Mapeia variations[].id do pedido -> ficha de unidade que originou aquela
// variação (estoque_anuncios_ml_variacoes, migration_043). Ausência de
// vínculo não é erro: anúncio publicado antes da 043, ou variação criada à
// mão no site do Mercado Livre, simplesmente cai como venda da peça-mãe.
async function resolverUnidadesPorVariacao(supabase: SupabaseClient, variationIds: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  if (variationIds.length === 0) return mapa;

  const { data, error } = await supabase.from('estoque_anuncios_ml_variacoes').select('ml_variation_id, unidade_id').in('ml_variation_id', variationIds);
  if (error) {
    if (ehErroDeMigrationAusente(error)) return mapa;
    throw error;
  }
  for (const linha of data ?? []) {
    if (linha.unidade_id) mapa.set(String(linha.ml_variation_id), linha.unidade_id);
  }
  return mapa;
}

export async function processarPedidosPendentes(supabase: SupabaseClient): Promise<ResultadoFilaPedidos> {
  const resultado: ResultadoFilaPedidos = { importados: 0, itensImportados: [], semMatch: [], ignorados: 0, aguardandoPagamento: 0, falhas: 0, abandonados: [] };

  const conexao = await obterConexaoAtual(supabase);
  if (!conexao) return resultado;

  const { data: pendentes, error: erroFila } = await supabase
    .from('mercadolivre_notificacoes')
    .select('id, topic, resource, tentativas, recebido_em')
    .eq('topic', 'orders_v2')
    .is('processado_em', null)
    .order('recebido_em', { ascending: true })
    .limit(PEDIDOS_POR_CICLO);

  if (erroFila) {
    if (ehErroDeMigrationAusente(erroFila)) {
      console.warn('⚠️ Fila de pedidos do Mercado Livre indisponível — rode supabase/migration_044_mercadolivre_fila_pedidos.sql. Importação automática desligada até lá.');
      return resultado;
    }
    throw erroFila;
  }
  if (!pendentes || pendentes.length === 0) return resultado;

  const formaPagamentoId = await obterFormaPagamentoMercadoLivre(supabase);
  if (!formaPagamentoId) {
    console.warn('⚠️ Forma de pagamento "MERCADO LIVRE" não encontrada — rode supabase/migration_044_mercadolivre_fila_pedidos.sql. Importação automática desligada até lá.');
    return resultado;
  }

  const mapaEstoque = await construirMapaEstoquePorMlb(supabase);

  // A venda importada do ML derruba o saldo da peça, e a peça pode ter OUTROS
  // anúncios (o vendido o próprio ML já decrementa). Acumula aqui pra avisar
  // uma vez só no fim do ciclo — nunca um push por pedido (ver spec, "Cuidado
  // com laço"). O aviso não muta anúncio nenhum: só chama a revisão manual.
  const estoqueIdsVendidos = new Set<string>();

  // Sequencial de propósito: cada linha vira escrita no banco, e um lote
  // paralelo de registrar_venda na mesma peça disputaria o mesmo saldo.
  for (const linha of pendentes) {
    try {
      const orderId = extrairOrderId(linha.resource);
      if (!orderId) {
        resultado.ignorados++;
        await marcarProcessado(supabase, linha.id, null);
        continue;
      }

      const pedido = await buscarPedido(conexao.accessToken, orderId);
      // Pedido apagado/inacessível (404 → null) não volta mais: descarta.
      if (!pedido) {
        resultado.ignorados++;
        await marcarProcessado(supabase, linha.id, null);
        continue;
      }
      if (pedido.status !== 'paid') {
        // Terminal → descarta. Transitório → deixa pendente pro próximo ciclo,
        // até o teto de DIAS_ESPERA_PAGAMENTO (senão checkout abandonado vira
        // linha eterna consumindo uma chamada de API a cada 5 minutos).
        if (STATUS_TERMINAIS_PEDIDO.includes(pedido.status)) {
          resultado.ignorados++;
          await marcarProcessado(supabase, linha.id, null);
          continue;
        }
        const esperandoDesde = linha.recebido_em ? new Date(linha.recebido_em).getTime() : Date.now();
        if (Date.now() - esperandoDesde > DIAS_ESPERA_PAGAMENTO * 24 * 60 * 60 * 1000) {
          resultado.ignorados++;
          await marcarProcessado(supabase, linha.id, `Pedido nunca foi pago em ${DIAS_ESPERA_PAGAMENTO} dias (status "${pedido.status}") — descartado da fila.`);
          continue;
        }
        resultado.aguardandoPagamento++;
        continue; // sem escrita nenhuma: a linha segue pendente
      }

      const variationIds = (pedido.order_items ?? [])
        .map((i: any) => (i.item?.variation_id != null ? String(i.item.variation_id) : null))
        .filter((id: string | null): id is string => !!id);
      const unidadesPorVariacao = await resolverUnidadesPorVariacao(supabase, variationIds);

      // No ML `order_items` é por VARIAÇÃO: duas fichas do mesmo anúncio no
      // mesmo pedido chegam como duas entradas com `item.id` idêntico. A
      // dedupe da venda é (ml_order_id, ml_item_id), sem variação, então a
      // segunda seria descartada em silêncio — peça vendida no ML e ainda
      // contada no estoque. Enquanto o índice não incluir a variação, a
      // primeira entra normal e as repetidas viram aviso pra registrar na mão.
      const vezesPorItemId = new Map<string, number>();
      for (const i of pedido.order_items ?? []) vezesPorItemId.set(i.item.id, (vezesPorItemId.get(i.item.id) ?? 0) + 1);
      const jaVistosNoPedido = new Set<string>();

      for (const itemPedido of pedido.order_items ?? []) {
        if (jaVistosNoPedido.has(itemPedido.item.id)) {
          resultado.semMatch.push({
            mlOrderId: orderId,
            titulo: itemPedido.item.title,
            motivo: `Pedido ${orderId} tem ${vezesPorItemId.get(itemPedido.item.id)} unidades do mesmo anúncio ("${itemPedido.item.title}") — só a primeira foi registrada, registre as outras na mão.`,
          });
          continue;
        }
        jaVistosNoPedido.add(itemPedido.item.id);

        const peca = mapaEstoque.get(itemPedido.item.id);
        if (!peca) {
          resultado.semMatch.push({ mlOrderId: orderId, titulo: itemPedido.item.title });
          continue;
        }
        try {
          const venda = await importarPedidoComoVenda(supabase, {
            estoqueId: peca.id,
            quantidade: itemPedido.quantity,
            valorUnitario: itemPedido.unit_price,
            formaPagamentoId,
            clienteNome: pedido.buyer?.nickname ?? null,
            data: pedido.date_created ?? null,
            mlOrderId: orderId,
            mlItemId: itemPedido.item.id,
            mlShippingId: pedido.shipping?.id ? String(pedido.shipping.id) : null,
            unidadeId: itemPedido.item.variation_id != null ? unidadesPorVariacao.get(String(itemPedido.item.variation_id)) ?? null : null,
          });
          if (venda) {
            resultado.importados++;
            resultado.itensImportados.push({ estoqueNome: peca.nome, mlOrderId: orderId });
            estoqueIdsVendidos.add(peca.id);
          }
        } catch (err: any) {
          // Saldo zerado é divergência real entre sistema e Mercado Livre —
          // repetir não resolve, quem resolve é uma pessoa. Vira aviso.
          if (ehErroDeEstoqueInsuficiente(err.message ?? '')) {
            resultado.semMatch.push({ mlOrderId: orderId, titulo: itemPedido.item.title });
          } else {
            throw err;
          }
        }
      }

      await marcarProcessado(supabase, linha.id, null);
    } catch (err: any) {
      resultado.falhas++;
      const tentativas = (linha.tentativas ?? 0) + 1;
      const mensagem = err?.response?.data?.message || err?.message || 'erro desconhecido';
      // Erro marcado como não-retentável (ver importarPedidoComoVenda): repetir
      // duplicaria venda e baixa de estoque. Encerra a linha com o erro à vista.
      if (err?.naoRetentar) {
        resultado.abandonados.push({ mlOrderId: extrairOrderId(linha.resource) ?? linha.resource, erro: mensagem });
        await marcarProcessado(supabase, linha.id, mensagem, tentativas);
      } else if (tentativas >= MAX_TENTATIVAS_PEDIDO) {
        resultado.abandonados.push({ mlOrderId: extrairOrderId(linha.resource) ?? linha.resource, erro: mensagem });
        await marcarProcessado(supabase, linha.id, mensagem, tentativas);
      } else {
        await supabase.from('mercadolivre_notificacoes').update({ tentativas, erro: mensagem }).eq('id', linha.id);
      }
    }
  }

  await avisarResultadoDaFila(supabase, resultado);
  await avisarAnunciosDesatualizados(supabase, Array.from(estoqueIdsVendidos));
  return resultado;
}

// Agregada por ciclo, nunca uma notificação por pedido — uma tarde
// movimentada não pode virar enxurrada de push. Nunca lança: falha de push
// não pode desfazer nem mascarar a importação, que já está no banco.
async function avisarResultadoDaFila(supabase: SupabaseClient, resultado: ResultadoFilaPedidos): Promise<void> {
  if (resultado.importados === 0 && resultado.semMatch.length === 0 && resultado.abandonados.length === 0) return;

  try {
    const destinatarios = await buscarDestinatariosEquipe(supabase);
    if (destinatarios.length === 0) return;

    if (resultado.importados > 0) {
      const nomes = Array.from(new Set(resultado.itensImportados.map((i) => i.estoqueNome)));
      const corpo =
        resultado.importados === 1
          ? `${nomes[0]} — baixa dada no estoque.`
          : `${resultado.importados} peças vendidas (${nomes.slice(0, 3).join(', ')}${nomes.length > 3 ? '...' : ''}) — baixa dada no estoque.`;
      await notificarUsuarios(supabase, destinatarios, { titulo: 'Venda no Mercado Livre', corpo, url: '/mercadolivre' });
    }

    if (resultado.semMatch.length > 0) {
      // Caso único ganha o texto específico (`motivo` quando existe, senão o
      // "não casou" padrão); em lote, o push agrega e a lista fica na aba.
      const corpo =
        resultado.semMatch.length === 1
          ? resultado.semMatch[0].motivo ??
            `"${resultado.semMatch[0].titulo}" (pedido ${resultado.semMatch[0].mlOrderId}) não casou com nenhuma peça do estoque — registre a venda na mão.`
          : `${resultado.semMatch.length} itens vendidos precisam ser registrados na mão — confira a lista na aba do Mercado Livre.`;
      await notificarUsuarios(supabase, destinatarios, { titulo: 'Pedido do ML precisa de você', corpo, url: '/mercadolivre' });
    }

    // Abandono é o pior desfecho da fila: venda que existe no ML e que o
    // sistema não vai mais tentar registrar. A ação associada é abrir a aba do
    // ML e importar na mão — por isso o push aponta pra lá.
    if (resultado.abandonados.length > 0) {
      const corpo =
        resultado.abandonados.length === 1
          ? `Pedido ${resultado.abandonados[0].mlOrderId} não pôde ser importado (${resultado.abandonados[0].erro}) — abra o Mercado Livre e registre a venda na mão.`
          : `${resultado.abandonados.length} pedidos do Mercado Livre não puderam ser importados (${resultado.abandonados.map((a) => a.mlOrderId).slice(0, 3).join(', ')}) — registre as vendas na mão.`;
      await notificarUsuarios(supabase, destinatarios, { titulo: 'Pedido do ML não foi importado', corpo, url: '/mercadolivre' });
    }
  } catch (err: any) {
    console.error('Erro ao notificar resultado da fila de pedidos do ML:', err?.message || err);
  }
}

// Contraparte do consumidor: quando a peça sai pelo estoque (balcão,
// orçamento aprovado, ou a própria importação automática), o anúncio no
// Mercado Livre fica anunciando quantidade que não existe mais. Isto AVISA —
// aplicar continua sendo revisão com checkbox (aplicarSincronizacao), porque
// mexer no anúncio muda a vitrine real da loja.
//
// Complementa (não substitui) o toast "Sincronizar agora" que VendasView e
// OrcamentosView já mostram: o toast é o caminho rápido pra quem está com a
// tela aberta; o push cobre outro aparelho, outra aba, e venda que nasceu da
// fila automática.
//
// Nunca lança: a venda já está registrada quando isto roda, e falha de aviso
// não pode virar erro 500 numa venda que deu certo.
export async function avisarAnunciosDesatualizados(supabase: SupabaseClient, estoqueIds: string[]): Promise<void> {
  if (estoqueIds.length === 0) return;

  try {
    const { data: links, error } = await supabase.from('estoque_anuncios_ml').select('estoque_id').in('estoque_id', estoqueIds);

    let afetadas: Set<string>;
    if (error) {
      if (!ehErroDeMigrationAusente(error)) throw error;
      // Mesmo fallback pro link legado que buscarLinksParaSincronizar e
      // construirMapaEstoquePorMlb já fazem. Sem ele, com a migration_025
      // pendente (situação de produção hoje), este gatilho seria inerte
      // justamente pras peças que TÊM anúncio.
      const { data: itens, error: erroLegado } = await supabase.from('estoque').select('id, anuncio_ml_url').in('id', estoqueIds).not('anuncio_ml_url', 'is', null);
      if (erroLegado) throw erroLegado;
      afetadas = new Set((itens ?? []).filter((i: any) => !!extrairMlbId(i.anuncio_ml_url)).map((i: any) => i.id));
    } else {
      afetadas = new Set((links ?? []).map((l: { estoque_id: string }) => l.estoque_id));
    }

    if (afetadas.size === 0) return;

    const destinatarios = await buscarDestinatariosEquipe(supabase);
    if (destinatarios.length === 0) return;

    const corpo =
      afetadas.size === 1
        ? '1 anúncio no Mercado Livre está com quantidade desatualizada. Revise e aplique.'
        : `${afetadas.size} anúncios no Mercado Livre estão com quantidade desatualizada. Revise e aplique.`;

    await notificarUsuarios(supabase, destinatarios, { titulo: 'Anúncio precisa de ajuste', corpo, url: '/mercadolivre' });
  } catch (err: any) {
    console.error('Erro ao avisar sobre anúncios desatualizados:', err?.message || err);
  }
}

async function marcarProcessado(supabase: SupabaseClient, id: string, erro: string | null, tentativas?: number): Promise<void> {
  const payload: Record<string, any> = { processado_em: new Date().toISOString(), erro };
  if (tentativas !== undefined) payload.tentativas = tentativas;
  const { error } = await supabase.from('mercadolivre_notificacoes').update(payload).eq('id', id);
  if (error && !ehErroDeMigrationAusente(error)) console.error('Erro ao marcar notificação do ML como processada:', error);
}
