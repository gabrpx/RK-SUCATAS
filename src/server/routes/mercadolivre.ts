// Integração com a API do Mercado Livre (OAuth2 + dados básicos da conta).
// Cada módulo futuro da aba (anúncios, etiquetas, mensagens) reaproveita
// `obterAccessTokenValido` — este arquivo só cuida de conectar a conta da
// loja e servir o primeiro módulo: os dados da página.
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';
import crypto from 'crypto';
import { requireEnv } from '../env.js';

const ML_AUTH_URL = 'https://auth.mercadolivre.com.br/authorization';
const ML_API_URL = 'https://api.mercadolibre.com';
const TABELA = 'mercadolivre_conexao';

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

// Troca um `code` (primeiro login) ou `refresh_token` (renovação) por um
// access_token novo, e já persiste o resultado. Mesmo formato de resposta
// nos dois casos — a API do Mercado Livre não distingue no retorno.
async function trocarTokens(supabase: SupabaseClient, params: Record<string, string>): Promise<string> {
  const { data } = await axios.post(`${ML_API_URL}/oauth/token`, null, {
    params: {
      client_id: requireEnv('MERCADOLIVRE_APP_ID'),
      client_secret: requireEnv('MERCADOLIVRE_CLIENT_SECRET'),
      ...params,
    },
    headers: { Accept: 'application/json' },
  });

  const expiraEm = new Date(Date.now() + data.expires_in * 1000).toISOString();
  const { error } = await supabase.from(TABELA).upsert(
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

  return data.access_token as string;
}

// Access token pronto pra usar — renova sozinho quando falta pouco pra
// expirar (token dura 6h). Assume uma única loja conectada: pega sempre a
// conexão mais recente. Retorna null se ninguém conectou a conta ainda.
export async function obterAccessTokenValido(supabase: SupabaseClient): Promise<string | null> {
  const { data: conexao } = await supabase.from(TABELA).select('*').order('atualizado_em', { ascending: false }).limit(1).maybeSingle();
  if (!conexao) return null;

  const faltamMs = new Date(conexao.expira_em).getTime() - Date.now();
  if (faltamMs > 5 * 60 * 1000) return conexao.access_token;

  return trocarTokens(supabase, { grant_type: 'refresh_token', refresh_token: conexao.refresh_token });
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
      const { data, error } = await supabase.from(TABELA).select('ml_user_id, atualizado_em').order('atualizado_em', { ascending: false }).limit(1).maybeSingle();
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

  // Primeiro módulo da aba: dados da própria página (nome, nickname,
  // reputação). Os outros módulos (anúncios, etiquetas, mensagens) entram
  // como rotas novas aqui quando forem construídos, um de cada vez.
  router.get('/me', async (_req, res) => {
    try {
      const token = await obterAccessTokenValido(supabase);
      if (!token) return res.status(409).json({ success: false, error: 'Conta do Mercado Livre ainda não conectada' });

      const { data } = await axios.get(`${ML_API_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } });
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.response?.data?.message || error.message });
    }
  });

  router.delete('/desconectar', async (_req, res) => {
    try {
      const { error } = await supabase.from(TABELA).delete().not('ml_user_id', 'is', null);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
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
