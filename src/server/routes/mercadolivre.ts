// Integração com a API do Mercado Livre. OAuth2 + dados básicos da conta
// (primeiro módulo) seguem aqui; a partir da migration_022 ganhou pedidos,
// perguntas, anúncios órfãos e reconciliação de preço/estoque — cada rota só
// orquestra, a lógica de verdade mora em src/services/mercadolivre{Api,Sync}.ts.
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';
import crypto from 'crypto';
import { requireEnv } from '../env.js';
import { exigirPermissao, exigirAlguma } from '../../../middleware/auth.js';
import { obterConexaoAtual, obterAccessTokenValido, trocarTokens, responderPergunta, obterMargemSincronizacao, atualizarMargemSincronizacao } from '../../services/mercadolivreApi.js';
import {
  buscarPreviewSincronizacao,
  aplicarSincronizacao,
  buscarPreviewPedidos,
  importarPedidosEmLote,
  corrigirTaxaVendasMlImportadas,
  buscarEnvioDoPedido,
  buscarPerguntasComRascunho,
  listarAnunciosOrfaos,
  listarAnunciosDuplicados,
  pausarAnuncio,
  contarPendencias,
  type ImportarPedidoParams,
} from '../../services/mercadolivreSync.js';
import {
  sugerirCategoria,
  buscarDetalheCategoria,
  buscarAtributosCategoriaComCache,
  buscarTiposAnuncioDisponiveis,
  listarFilhosCategoria,
  buscarProdutosCatalogo,
} from '../../services/mercadolivrePublicacao.js';

const ML_AUTH_URL = 'https://auth.mercadolivre.com.br/authorization';
const ML_API_URL = 'https://api.mercadolibre.com';

// `state` do OAuth: prova que o callback corresponde a um login que a gente
// mesmo iniciou (proteção contra CSRF). Fica em memória de propósito — só
// precisa sobreviver os poucos minutos entre "clicar em conectar" e o
// Mercado Livre redirecionar de volta, não sobreviver a um restart do processo.
const estadosPendentes = new Map<string, number>();
const ESTADO_TTL_MS = 10 * 60 * 1000;

function limparEstadosExpirados() {
  const agora = Date.now();
  for (const [estado, criadoEm] of estadosPendentes) {
    if (agora - criadoEm > ESTADO_TTL_MS) estadosPendentes.delete(estado);
  }
}

function mensagemErro(error: any): string {
  return error.response?.data?.message || error.message;
}

export function mercadolivreRouter(supabase: SupabaseClient) {
  const router = Router();

  // Gera a URL de login do Mercado Livre. O frontend chama isso (autenticado)
  // e faz `window.location = url` — a troca de code por token de verdade
  // acontece no callback público, ver mercadolivreCallbackHandler abaixo.
  router.get('/auth/login', exigirPermissao('mercadolivre.conectar'), (_req, res) => {
    limparEstadosExpirados();
    const estado = crypto.randomBytes(24).toString('hex');
    estadosPendentes.set(estado, Date.now());

    const url = new URL(ML_AUTH_URL);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', requireEnv('MERCADOLIVRE_APP_ID'));
    url.searchParams.set('redirect_uri', requireEnv('MERCADOLIVRE_REDIRECT_URI'));
    url.searchParams.set('state', estado);

    res.json({ success: true, url: url.toString() });
  });

  router.get('/status', exigirPermissao('mercadolivre.ver'), async (_req, res) => {
    try {
      const { data, error } = await supabase.from('mercadolivre_conexao').select('ml_user_id, atualizado_em').order('atualizado_em', { ascending: false }).limit(1).maybeSingle();
      if (error) {
        // 42P01 = tabela não existe; PGRST205 = PostgREST ainda não a conhece.
        // Mesmo padrão de degradação graciosa de anexarUnidades em estoque.ts:
        // enquanto a migration_021 não roda em produção, a aba só mostra
        // "desconectado" em vez de quebrar.
        if (error.code === '42P01' || error.code === 'PGRST205') {
          return res.json({ success: true, conectado: false, ml_user_id: null });
        }
        throw error;
      }
      res.json({ success: true, conectado: !!data, ml_user_id: data?.ml_user_id ?? null });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Dados da própria página (nome, nickname, reputação).
  router.get('/me', exigirPermissao('mercadolivre.ver'), async (_req, res) => {
    try {
      const token = await obterAccessTokenValido(supabase);
      if (!token) return res.status(409).json({ success: false, error: 'Conta do Mercado Livre ainda não conectada' });

      const { data } = await axios.get(`${ML_API_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } });
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });

  router.delete('/desconectar', exigirPermissao('mercadolivre.conectar'), async (_req, res) => {
    try {
      const { error } = await supabase.from('mercadolivre_conexao').delete().not('ml_user_id', 'is', null);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==========================================================================
  // Features 1 + 7 — sincronização de anúncio (preço, quantidade, status),
  // com revisão explícita: preview calcula sem escrever, aplicar escreve só
  // o que foi selecionado na lista.
  // ==========================================================================

  router.get('/sincronizacao/preview', exigirPermissao('mercadolivre.ver'), async (_req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase);
      if (!conexao) return res.status(409).json({ success: false, error: 'Conta do Mercado Livre ainda não conectada' });

      const preview = await buscarPreviewSincronizacao(supabase, conexao.accessToken);
      res.json({ success: true, data: preview });
    } catch (error: any) {
      console.error('Erro ao calcular preview de sincronização do Mercado Livre:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });

  router.post('/sincronizacao/aplicar', exigirPermissao('mercadolivre.sincronizar'), async (req, res) => {
    try {
      const linkIds = Array.isArray(req.body?.linkIds) ? req.body.linkIds.map((id: any) => String(id)) : [];
      if (linkIds.length === 0) return res.status(400).json({ success: false, error: 'Selecione ao menos um anúncio pra sincronizar' });

      const conexao = await obterConexaoAtual(supabase);
      if (!conexao) return res.status(409).json({ success: false, error: 'Conta do Mercado Livre ainda não conectada' });

      const resultado = await aplicarSincronizacao(supabase, conexao.accessToken, linkIds);
      res.json({ success: true, data: resultado });
    } catch (error: any) {
      console.error('Erro ao aplicar sincronização do Mercado Livre:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });

  // ==========================================================================
  // Margem de repasse aplicada no cálculo de preço novo da sincronização
  // (migration_026) — padrão 30%, editável pela própria tela.
  // ==========================================================================

  router.get('/configuracoes', exigirPermissao('mercadolivre.ver'), async (_req, res) => {
    try {
      const margemPercentual = await obterMargemSincronizacao(supabase);
      res.json({ success: true, data: { margemPercentual } });
    } catch (error: any) {
      console.error('Erro ao buscar configurações do Mercado Livre:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.patch('/configuracoes', exigirPermissao('mercadolivre.conectar'), async (req, res) => {
    try {
      const margemPercentual = Number(req.body?.margem_percentual);
      if (!Number.isFinite(margemPercentual) || margemPercentual < 0 || margemPercentual > 500) {
        return res.status(400).json({ success: false, error: 'A margem deve ser um número entre 0 e 500' });
      }
      await atualizarMargemSincronizacao(supabase, margemPercentual);
      res.json({ success: true, data: { margemPercentual } });
    } catch (error: any) {
      console.error('Erro ao atualizar configurações do Mercado Livre:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==========================================================================
  // Feature 6 — anúncios ativos no ML sem peça local correspondente
  // ==========================================================================

  router.get('/anuncios-orfaos', exigirPermissao('mercadolivre.ver'), async (_req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase);
      if (!conexao) return res.status(409).json({ success: false, error: 'Conta do Mercado Livre ainda não conectada' });

      const orfaos = await listarAnunciosOrfaos(supabase, conexao.accessToken, conexao.mlUserId);
      res.json({ success: true, data: orfaos });
    } catch (error: any) {
      console.error('Erro ao listar anúncios órfãos do Mercado Livre:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });

  // ==========================================================================
  // Feature C — anúncios duplicados no próprio catálogo do ML
  // ==========================================================================

  router.get('/anuncios-duplicados', exigirPermissao('mercadolivre.ver'), async (_req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase);
      if (!conexao) return res.status(409).json({ success: false, error: 'Conta do Mercado Livre ainda não conectada' });

      const duplicados = await listarAnunciosDuplicados(supabase, conexao.accessToken, conexao.mlUserId);
      res.json({ success: true, data: duplicados });
    } catch (error: any) {
      console.error('Erro ao listar anúncios duplicados do Mercado Livre:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });

  router.post('/anuncios/:mlbId/pausar', exigirPermissao('mercadolivre.pausar_anuncio'), async (req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase);
      if (!conexao) return res.status(409).json({ success: false, error: 'Conta do Mercado Livre ainda não conectada' });

      await pausarAnuncio(conexao.accessToken, req.params.mlbId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao pausar anúncio do Mercado Livre:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });

  // ==========================================================================
  // Feature 2 — preview e importação de pedidos como venda
  // ==========================================================================

  router.get('/pedidos/novos', exigirPermissao('mercadolivre.ver'), async (req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase);
      if (!conexao) return res.status(409).json({ success: false, error: 'Conta do Mercado Livre ainda não conectada' });

      const dias = Number(req.query.dias) || 30;
      const pedidos = await buscarPreviewPedidos(supabase, conexao.accessToken, conexao.mlUserId, dias);
      res.json({ success: true, data: pedidos });
    } catch (error: any) {
      console.error('Erro ao buscar pedidos novos do Mercado Livre:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });

  router.post('/pedidos/importar', exigirPermissao('mercadolivre.importar_pedidos'), async (req, res) => {
    try {
      const itensBody = Array.isArray(req.body?.itens) ? req.body.itens : [];
      if (itensBody.length === 0) return res.status(400).json({ success: false, error: 'Selecione ao menos um item pra importar' });

      const itens: ImportarPedidoParams[] = itensBody.map((i: any) => ({
        estoqueId: i.estoque_id,
        quantidade: Number(i.quantidade) || 1,
        valorUnitario: Number(i.valor_unitario) || 0,
        formaPagamentoId: i.forma_pagamento_id,
        clienteNome: i.cliente_nome || null,
        clienteId: i.cliente_id || null,
        data: i.data || null,
        mlOrderId: String(i.ml_order_id),
        mlItemId: String(i.ml_item_id),
        mlShippingId: i.ml_shipping_id ? String(i.ml_shipping_id) : null,
        mlSaleFee: i.ml_sale_fee != null ? Number(i.ml_sale_fee) : null,
        mlCustoEnvio: i.ml_custo_envio != null ? Number(i.ml_custo_envio) : null,
        mlDescontoVendedor: Number(i.ml_desconto_vendedor) || 0,
      }));

      const resultado = await importarPedidosEmLote(supabase, itens);
      res.json({ success: true, data: resultado });
    } catch (error: any) {
      console.error('Erro ao importar pedidos do Mercado Livre:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Correção retroativa: vendas ML já importadas com o valor CHEIO no Caixa
  // (antes deste fix) passam a ter o valor líquido (menos a taxa do ML),
  // recalculada consultando a API do Mercado Livre pedido a pedido. Só
  // dispara por clique humano na tela do Mercado Livre — nunca automático.
  router.post('/pedidos/corrigir-taxa', exigirPermissao('mercadolivre.importar_pedidos'), async (_req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase);
      if (!conexao) return res.status(409).json({ success: false, error: 'Conta do Mercado Livre ainda não conectada' });

      const resultado = await corrigirTaxaVendasMlImportadas(supabase, conexao.accessToken);
      res.json({ success: true, data: resultado });
    } catch (error: any) {
      console.error('Erro ao corrigir taxa de vendas importadas do Mercado Livre:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });

  // ==========================================================================
  // Feature 10 — dados de envio (Mercado Envios) de um pedido já importado
  // ==========================================================================

  router.get('/pedidos/:mlOrderId/envio', exigirPermissao('mercadolivre.ver'), async (req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase);
      if (!conexao) return res.status(409).json({ success: false, error: 'Conta do Mercado Livre ainda não conectada' });

      const envio = await buscarEnvioDoPedido(supabase, conexao.accessToken, req.params.mlOrderId);
      res.json({ success: true, data: envio });
    } catch (error: any) {
      console.error('Erro ao buscar envio do pedido do Mercado Livre:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });

  // ==========================================================================
  // Feature 3 — central de perguntas
  // ==========================================================================

  router.get('/perguntas', exigirPermissao('mercadolivre.ver'), async (_req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase);
      if (!conexao) return res.status(409).json({ success: false, error: 'Conta do Mercado Livre ainda não conectada' });

      const perguntas = await buscarPerguntasComRascunho(supabase, conexao.accessToken, conexao.mlUserId);
      res.json({ success: true, data: perguntas });
    } catch (error: any) {
      console.error('Erro ao buscar perguntas do Mercado Livre:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });

  router.post('/perguntas/:questionId/responder', exigirPermissao('mercadolivre.responder_perguntas'), async (req, res) => {
    try {
      const texto = String(req.body?.texto || '').trim();
      if (!texto) return res.status(400).json({ success: false, error: 'Escreva uma resposta antes de enviar' });

      const conexao = await obterConexaoAtual(supabase);
      if (!conexao) return res.status(409).json({ success: false, error: 'Conta do Mercado Livre ainda não conectada' });

      await responderPergunta(conexao.accessToken, Number(req.params.questionId), texto);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao responder pergunta do Mercado Livre:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });

  // ==========================================================================
  // Feature 9 — indicador ao vivo de pendências (a tabela de notificações do
  // scheduler é só um sinal de frescor, não a fonte desta contagem)
  // ==========================================================================

  router.get('/pendencias', exigirPermissao('mercadolivre.ver'), async (_req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase);
      // Sem conta conectada não há nada pendente a mostrar — devolve zerado
      // em vez de erro, porque este endpoint alimenta um indicador passivo,
      // não uma ação que a pessoa esteja tentando fazer agora.
      if (!conexao) return res.json({ success: true, data: { perguntasSemResposta: 0, pedidosNovos: 0 } });

      const contagem = await contarPendencias(supabase, conexao.accessToken, conexao.mlUserId);
      res.json({ success: true, data: contagem });
    } catch (error: any) {
      // Mesmo motivo do caso "sem conta" acima: qualquer falha aqui (ex:
      // migration_022 ainda não rodou, token expirado, API do ML fora do ar)
      // também devolve zerado em vez de erro — nunca trava o indicador passivo.
      console.warn('Indicador de pendências do Mercado Livre indisponível:', error.response?.data || error.message);
      res.json({ success: true, data: { perguntasSemResposta: 0, pedidosNovos: 0 } });
    }
  });

  // ==========================================================================
  // Publicação de anúncios novos (migration_043) — categoria, atributos e
  // tipos de anúncio pro formulário dinâmico. A publicação em si (POST
  // /items) fica em src/server/routes/estoque.ts, aninhada na peça — ver
  // POST /:id/publicar-ml.
  // ==========================================================================

  router.get('/categorias/sugerir', exigirAlguma('mercadolivre.ver', 'estoque.anunciar_ml'), async (req, res) => {
    try {
      const titulo = String(req.query.titulo || '').trim();
      if (!titulo) return res.status(400).json({ success: false, error: 'Informe um título pra sugerir a categoria' });

      const conexao = await obterConexaoAtual(supabase);
      if (!conexao) return res.status(409).json({ success: false, error: 'Conta do Mercado Livre ainda não conectada' });

      const sugestoes = await sugerirCategoria(conexao.accessToken, titulo);
      res.json({ success: true, data: sugestoes });
    } catch (error: any) {
      console.error('Erro ao sugerir categoria do Mercado Livre:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });

  // Navegação manual em árvore — parâmetro ausente = categorias raiz do site.
  // Equivalente ao "É de outra categoria" do site oficial, pra quando o
  // preditor (rota acima) erra o domínio.
  router.get('/categorias/filhos', exigirAlguma('mercadolivre.ver', 'estoque.anunciar_ml'), async (req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase);
      if (!conexao) return res.status(409).json({ success: false, error: 'Conta do Mercado Livre ainda não conectada' });

      const categoriaId = req.query.categoria_id ? String(req.query.categoria_id) : undefined;
      const filhos = await listarFilhosCategoria(conexao.accessToken, categoriaId);
      res.json({ success: true, data: filhos });
    } catch (error: any) {
      console.error('Erro ao listar subcategorias do Mercado Livre:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });

  // Padronizar categoria (Fase 4): categorias.mercadolivre_categoria_id_padrao
  // só guarda o id — esta rota resolve nome/caminho pra pré-selecionar a
  // categoria no formulário sem precisar rebuscar por título nem navegar de
  // novo em árvore.
  router.get('/categorias/:id', exigirAlguma('mercadolivre.ver', 'estoque.anunciar_ml'), async (req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase);
      if (!conexao) return res.status(409).json({ success: false, error: 'Conta do Mercado Livre ainda não conectada' });

      const detalhe = await buscarDetalheCategoria(conexao.accessToken, req.params.id);
      res.json({ success: true, data: detalhe });
    } catch (error: any) {
      console.error('Erro ao buscar detalhe de categoria do Mercado Livre:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });

  router.get('/categorias/:id/atributos', exigirAlguma('mercadolivre.ver', 'estoque.anunciar_ml'), async (req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase);
      if (!conexao) return res.status(409).json({ success: false, error: 'Conta do Mercado Livre ainda não conectada' });

      const atributos = await buscarAtributosCategoriaComCache(supabase, conexao.accessToken, req.params.id);
      res.json({ success: true, data: atributos });
    } catch (error: any) {
      console.error('Erro ao buscar atributos de categoria do Mercado Livre:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });

  // Busca produtos de catálogo parecidos com o título — "reconhecer
  // produtos" antes de publicar numa categoria catalog_required (Parte do
  // fluxo de EstoquePublicarMlModal.tsx: escolhe um produto ou segue sem
  // vínculo, "Não é o que eu vendo").
  router.get('/produtos-catalogo', exigirAlguma('mercadolivre.ver', 'estoque.anunciar_ml'), async (req, res) => {
    try {
      const titulo = String(req.query.titulo || '').trim();
      if (!titulo) return res.status(400).json({ success: false, error: 'Informe um título pra buscar produtos de catálogo' });

      const conexao = await obterConexaoAtual(supabase);
      if (!conexao) return res.status(409).json({ success: false, error: 'Conta do Mercado Livre ainda não conectada' });

      const produtos = await buscarProdutosCatalogo(conexao.accessToken, titulo);
      res.json({ success: true, data: produtos });
    } catch (error: any) {
      console.error('Erro ao buscar produtos de catálogo do Mercado Livre:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });

  // Sem parâmetro de categoria de propósito: GET /sites/{site}/listing_prices
  // (a API real por trás disso) só filtra por preço — não existe um recurso
  // do Mercado Livre que filtre tipo de anúncio por categoria.
  router.get('/tipos-anuncio', exigirAlguma('mercadolivre.ver', 'estoque.anunciar_ml'), async (req, res) => {
    try {
      const preco = Number(req.query.preco);
      if (!Number.isFinite(preco) || preco <= 0) return res.status(400).json({ success: false, error: 'Informe um preço válido' });

      const conexao = await obterConexaoAtual(supabase);
      if (!conexao) return res.status(409).json({ success: false, error: 'Conta do Mercado Livre ainda não conectada' });

      const tipos = await buscarTiposAnuncioDisponiveis(conexao.accessToken, preco);
      res.json({ success: true, data: tipos });
    } catch (error: any) {
      console.error('Erro ao buscar tipos de anúncio do Mercado Livre:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });

  return router;
}

// Fora do gate de JWT de propósito (server.ts monta isso na seção de rotas
// públicas): o Mercado Livre redireciona o navegador de volta pra cá sem
// nenhum jeito de carregar nosso Bearer token junto — é uma navegação normal
// do browser, não uma chamada fetch() nossa. Quem garante que esse callback
// corresponde a um login que a gente mesmo iniciou é o `state` de uso único.
export function mercadolivreCallbackHandler(supabase: SupabaseClient) {
  return async (req: any, res: any) => {
    limparEstadosExpirados();
    const { code, state, error: erroML } = req.query as Record<string, string>;
    const appUrl = process.env.APP_URL || '';

    if (erroML) return res.redirect(`${appUrl}/mercadolivre?ml_erro=${encodeURIComponent(erroML)}`);
    if (!code || !state || !estadosPendentes.has(state)) {
      return res.redirect(`${appUrl}/mercadolivre?ml_erro=estado_invalido`);
    }
    estadosPendentes.delete(state);

    try {
      await trocarTokens(supabase, { grant_type: 'authorization_code', code, redirect_uri: requireEnv('MERCADOLIVRE_REDIRECT_URI') });
      res.redirect(`${appUrl}/mercadolivre?conectado=1`);
    } catch (err: any) {
      console.error('Erro ao trocar code por token do Mercado Livre:', err.response?.data || err.message);
      res.redirect(`${appUrl}/mercadolivre?ml_erro=troca_token`);
    }
  };
}

// Feature 9 — endpoint público (montado em server.ts antes do gate de JWT,
// mesmo bloco do callback OAuth acima) que recebe as notificações do
// Mercado Livre. Responde 200 IMEDIATAMENTE — a doc do ML desativa o topic
// depois de falhas repetidas de entrega dentro da janela esperada — e só
// depois registra a notificação, fora do caminho crítico da resposta.
//
// Propriedade de segurança importante: o corpo do webhook nunca é usado como
// dado, só como gatilho pra "ir buscar" — a leitura real de pedido/pergunta
// sempre usa nosso próprio token contra a API oficial do ML (ver
// mercadolivreSync.ts). Não há caminho de dado não confiável entrando no
// sistema por aqui; o check de application_id abaixo só evita logar lixo de
// notificação de outro aplicativo por engano, não é a defesa de segurança em si.
export function mercadolivreWebhookHandler(supabase: SupabaseClient) {
  return async (req: any, res: any) => {
    res.sendStatus(200);

    const { topic, resource, user_id, application_id } = req.body || {};
    if (!topic || !resource) return;
    if (application_id && String(application_id) !== process.env.MERCADOLIVRE_APP_ID) return;

    const { error } = await supabase
      .from('mercadolivre_notificacoes')
      .upsert({ topic, resource, ml_user_id: user_id ? String(user_id) : null, origem: 'webhook' }, { onConflict: 'topic,resource', ignoreDuplicates: true });

    if (error && error.code !== '42P01' && error.code !== 'PGRST205') {
      console.error('Erro ao registrar notificação do Mercado Livre:', error);
    }
  };
}
