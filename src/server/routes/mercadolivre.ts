// Integração com a API do Mercado Livre. OAuth2 + dados básicos da conta
// (primeiro módulo) seguem aqui; a partir da migration_022 ganhou pedidos,
// perguntas, anúncios órfãos e reconciliação de preço/estoque — cada rota só
// orquestra, a lógica de verdade mora em src/services/mercadolivre{Api,Sync}.ts.
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';
import crypto from 'crypto';
import { requireEnv } from '../env.js';
import { obterConexaoAtual, obterAccessTokenValido, trocarTokens, responderPergunta } from '../../services/mercadolivreApi.js';
import {
  sincronizarAnuncio,
  reconciliarCatalogoCompleto,
  buscarPreviewPedidos,
  importarPedidosEmLote,
  buscarEnvioDoPedido,
  buscarPerguntasComRascunho,
  listarAnunciosOrfaos,
  contarPendencias,
  type ImportarPedidoParams,
} from '../../services/mercadolivreSync.js';

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
  router.get('/auth/login', (_req, res) => {
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

  router.get('/status', async (_req, res) => {
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
  router.get('/me', async (_req, res) => {
    try {
      const token = await obterAccessTokenValido(supabase);
      if (!token) return res.status(409).json({ success: false, error: 'Conta do Mercado Livre ainda não conectada' });

      const { data } = await axios.get(`${ML_API_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } });
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });

  router.delete('/desconectar', async (_req, res) => {
    try {
      const { error } = await supabase.from('mercadolivre_conexao').delete().not('ml_user_id', 'is', null);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==========================================================================
  // Features 1 + 7 — reconciliação manual de anúncio (preço, quantidade, status)
  // ==========================================================================

  router.post('/anuncios/:estoqueId/sincronizar', async (req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase);
      if (!conexao) return res.status(409).json({ success: false, error: 'Conta do Mercado Livre ainda não conectada' });

      const resultado = await sincronizarAnuncio(supabase, conexao.accessToken, req.params.estoqueId);
      res.json({ success: true, data: resultado });
    } catch (error: any) {
      console.error('Erro ao sincronizar anúncio do Mercado Livre:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });

  router.post('/anuncios/sincronizar', async (_req, res) => {
    try {
      const conexao = await obterConexaoAtual(supabase);
      if (!conexao) return res.status(409).json({ success: false, error: 'Conta do Mercado Livre ainda não conectada' });

      const resultado = await reconciliarCatalogoCompleto(supabase, conexao.accessToken);
      res.json({ success: true, data: resultado });
    } catch (error: any) {
      console.error('Erro ao sincronizar catálogo com o Mercado Livre:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });

  // ==========================================================================
  // Feature 6 — anúncios ativos no ML sem peça local correspondente
  // ==========================================================================

  router.get('/anuncios-orfaos', async (_req, res) => {
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
  // Feature 2 — preview e importação de pedidos como venda
  // ==========================================================================

  router.get('/pedidos/novos', async (req, res) => {
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

  router.post('/pedidos/importar', async (req, res) => {
    try {
      const itensBody = Array.isArray(req.body?.itens) ? req.body.itens : [];
      if (itensBody.length === 0) return res.status(400).json({ success: false, error: 'Selecione ao menos um item pra importar' });

      const itens: ImportarPedidoParams[] = itensBody.map((i: any) => ({
        estoqueId: i.estoque_id,
        quantidade: Number(i.quantidade) || 1,
        valorUnitario: Number(i.valor_unitario) || 0,
        formaPagamentoId: i.forma_pagamento_id,
        clienteNome: i.cliente_nome || null,
        data: i.data || null,
        mlOrderId: String(i.ml_order_id),
        mlItemId: String(i.ml_item_id),
        mlShippingId: i.ml_shipping_id ? String(i.ml_shipping_id) : null,
      }));

      const resultado = await importarPedidosEmLote(supabase, itens);
      res.json({ success: true, data: resultado });
    } catch (error: any) {
      console.error('Erro ao importar pedidos do Mercado Livre:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==========================================================================
  // Feature 10 — dados de envio (Mercado Envios) de um pedido já importado
  // ==========================================================================

  router.get('/pedidos/:mlOrderId/envio', async (req, res) => {
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

  router.get('/perguntas', async (_req, res) => {
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

  router.post('/perguntas/:questionId/responder', async (req, res) => {
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

  router.get('/pendencias', async (_req, res) => {
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
