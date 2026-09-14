// Integração com a API da Shopee. OAuth2 + dados básicos da conexão seguem
// aqui, mesmo formato de src/server/routes/mercadolivre.ts — cada rota só
// orquestra, a lógica de verdade mora em src/services/shopee{Api,Publicacao}.ts.
// Nenhum arquivo do Mercado Livre é importado ou alterado aqui.
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import {
  gerarUrlAutorizacaoShopee,
  trocarCodigoPorTokenShopee,
  obterConexaoAtualShopee,
  obterMargemSincronizacaoShopee,
  atualizarMargemSincronizacaoShopee,
  buscarCategoriasRaizShopee,
  buscarCategoriaShopee,
  buscarCanaisLogisticaShopee,
  TABELA_CONEXAO,
} from '../../services/shopeeApi.js';
import { buscarAtributosCategoriaComCache, buscarCanalLogisticaPadrao } from '../../services/shopeePublicacao.js';
import { exigirPermissao, exigirAlguma } from '../../../middleware/auth.js';

// `state` do OAuth: prova que o callback corresponde a um login que a gente
// mesmo iniciou (proteção contra CSRF) — mesmo mecanismo do Mercado Livre.
// Fica em memória de propósito: só precisa sobreviver os poucos minutos
// entre "clicar em conectar" e a Shopee redirecionar de volta.
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

export function shopeeRouter(supabase: SupabaseClient) {
  const router = Router();

  // Gera a URL de login da loja Shopee. O frontend chama isso (autenticado)
  // e faz `window.location = url` — a troca de code por token de verdade
  // acontece no callback público, ver shopeeCallbackHandler abaixo.
  router.get('/auth/login', exigirPermissao('estoque.anunciar_shopee'), (_req, res) => {
    limparEstadosExpirados();
    const estado = crypto.randomBytes(24).toString('hex');
    estadosPendentes.set(estado, Date.now());
    res.json({ success: true, url: gerarUrlAutorizacaoShopee(estado) });
  });

  router.get('/status', exigirAlguma('estoque.ver', 'estoque.anunciar_shopee'), async (_req, res) => {
    try {
      const { data, error } = await supabase.from(TABELA_CONEXAO).select('shop_id, atualizado_em').order('atualizado_em', { ascending: false }).limit(1).maybeSingle();
      if (error) {
        // 42P01 = tabela não existe; PGRST205 = PostgREST ainda não a conhece.
        // Mesma degradação graciosa de GET /mercadolivre/status: enquanto a
        // migration_045 não roda em produção, a aba só mostra "desconectado".
        if (error.code === '42P01' || error.code === 'PGRST205') {
          return res.json({ success: true, conectado: false, shop_id: null });
        }
        throw error;
      }
      res.json({ success: true, conectado: !!data, shop_id: data?.shop_id ?? null });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete('/desconectar', exigirPermissao('estoque.anunciar_shopee'), async (_req, res) => {
    try {
      const { error } = await supabase.from(TABELA_CONEXAO).delete().not('shop_id', 'is', null);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==========================================================================
  // Margem de repasse aplicada no preço publicado na Shopee — própria do
  // canal (shopee_conexao.margem_sincronizacao_percentual), NUNCA a mesma
  // coluna do Mercado Livre. Padrão 30%, editável pela própria tela.
  // ==========================================================================

  router.get('/configuracoes', exigirAlguma('estoque.ver', 'estoque.anunciar_shopee'), async (_req, res) => {
    try {
      const margemPercentual = await obterMargemSincronizacaoShopee(supabase);
      res.json({ success: true, data: { margemPercentual } });
    } catch (error: any) {
      console.error('Erro ao buscar configurações da Shopee:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.patch('/configuracoes', exigirPermissao('estoque.anunciar_shopee'), async (req, res) => {
    try {
      const margemPercentual = Number(req.body?.margem_percentual);
      if (!Number.isFinite(margemPercentual) || margemPercentual < 0 || margemPercentual > 500) {
        return res.status(400).json({ success: false, error: 'A margem deve ser um número entre 0 e 500' });
      }
      await atualizarMargemSincronizacaoShopee(supabase, margemPercentual);
      res.json({ success: true, data: { margemPercentual } });
    } catch (error: any) {
      console.error('Erro ao atualizar configurações da Shopee:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==========================================================================
  // Categoria, atributos e logística pro formulário de publicação. A
  // publicação em si (add_item) fica em src/server/routes/estoque.ts,
  // aninhada na peça — ver POST /:id/publicar-shopee.
  // ==========================================================================

  // Sem preditor de categoria confirmado pra Shopee (Parte 1.3 da proposta)
  // — a navegação nasce só em árvore. Sem parâmetro = raiz.
  router.get('/categorias', exigirAlguma('estoque.ver', 'estoque.anunciar_shopee'), async (_req, res) => {
    try {
      const conexao = await obterConexaoAtualShopee(supabase);
      if (!conexao) return res.status(409).json({ success: false, error: 'Loja da Shopee ainda não conectada' });

      const raiz = await buscarCategoriasRaizShopee(conexao.accessToken, conexao.shopId);
      res.json({ success: true, data: raiz });
    } catch (error: any) {
      console.error('Erro ao listar categorias raiz da Shopee:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });

  // Filhos da categoria (navegação em árvore) + atributos (formulário
  // dinâmico) numa chamada só — a UI sempre precisa dos dois ao entrar num
  // nó: se a categoria for folha (sem filhos), os atributos já vêm prontos
  // pro formulário; se não for, os atributos ficam vazios até o usuário
  // descer mais.
  router.get('/categorias/:id', exigirAlguma('estoque.ver', 'estoque.anunciar_shopee'), async (req, res) => {
    try {
      const conexao = await obterConexaoAtualShopee(supabase);
      if (!conexao) return res.status(409).json({ success: false, error: 'Loja da Shopee ainda não conectada' });

      const categoriaId = Number(req.params.id);
      const detalhe = await buscarCategoriaShopee(conexao.accessToken, conexao.shopId, categoriaId);
      const atributos = await buscarAtributosSeCategoriaFolha(conexao.accessToken, conexao.shopId, categoriaId, detalhe.filhos.length);
      res.json({ success: true, data: { categoria: detalhe.categoria, filhos: detalhe.filhos, atributos } });
    } catch (error: any) {
      console.error('Erro ao buscar categoria da Shopee:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });

  router.get('/canais-logistica', exigirAlguma('estoque.ver', 'estoque.anunciar_shopee'), async (_req, res) => {
    try {
      const conexao = await obterConexaoAtualShopee(supabase);
      if (!conexao) return res.status(409).json({ success: false, error: 'Loja da Shopee ainda não conectada' });

      const sugestao = await buscarCanalLogisticaPadrao(conexao.accessToken, conexao.shopId);
      res.json({ success: true, data: sugestao });
    } catch (error: any) {
      console.error('Erro ao listar canais de logística da Shopee:', error.response?.data || error.message);
      res.status(500).json({ success: false, error: mensagemErro(error) });
    }
  });

  // Atributos só fazem sentido buscar pra categoria que o usuário efetivamente
  // vai usar (folha da árvore) — categoria com filhos ainda não é
  // publicável, então evita bater na API por atributos que a UI vai
  // descartar. buscarAtributosCategoriaComCache já cacheia por 7 dias.
  async function buscarAtributosSeCategoriaFolha(accessToken: string, shopId: string, categoriaId: number, quantidadeFilhos: number) {
    if (quantidadeFilhos > 0) return [];
    return buscarAtributosCategoriaComCache(supabase, accessToken, shopId, categoriaId);
  }

  return router;
}

// Fora do gate de JWT de propósito (server.ts monta isso na seção de rotas
// públicas): a Shopee redireciona o navegador de volta pra cá sem nenhum
// jeito de carregar nosso Bearer token junto — é uma navegação normal do
// browser, não uma chamada fetch() nossa. Mesmo raciocínio de
// mercadolivreCallbackHandler; quem garante que esse callback corresponde a
// um login que a gente mesmo iniciou é o `state` de uso único.
export function shopeeCallbackHandler(supabase: SupabaseClient) {
  return async (req: any, res: any) => {
    limparEstadosExpirados();
    const { code, shop_id: shopId, state, error: erroShopee } = req.query as Record<string, string>;
    const appUrl = process.env.APP_URL || '';

    if (erroShopee) return res.redirect(`${appUrl}/estoque?shopee_erro=${encodeURIComponent(erroShopee)}`);
    if (!code || !shopId || !state || !estadosPendentes.has(state)) {
      return res.redirect(`${appUrl}/estoque?shopee_erro=estado_invalido`);
    }
    estadosPendentes.delete(state);

    try {
      await trocarCodigoPorTokenShopee(supabase, code, shopId);
      res.redirect(`${appUrl}/estoque?shopee_conectado=1`);
    } catch (err: any) {
      console.error('Erro ao trocar code por token da Shopee:', err.response?.data || err.message);
      res.redirect(`${appUrl}/estoque?shopee_erro=troca_token`);
    }
  };
}
