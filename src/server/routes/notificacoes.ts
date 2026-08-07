// Rotas de push notifications — montada em server.ts SEM autorizar() no
// mount, mesmo padrão de exceção já usado antes pelo endpoint velho
// /api/usuarios/me/push-token (removido, absorvido aqui): todo usuário
// autenticado mexe só nas próprias subscriptions, nunca em nome de outro —
// toda rota escopa por req.usuario!.id, nunca aceita usuario_id vindo do body.
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthenticatedRequest } from '../../../middleware/auth.js';

const SELECT_SUBSCRIPTION = 'id, tipo, user_agent, ativo, criado_em';

export function notificacoesRouter(supabase: SupabaseClient) {
  const router = Router();

  // Pública o bastante pra ser chamada antes de qualquer subscribe (só expõe
  // a chave pública VAPID, que não é secreta por definição do protocolo) —
  // mas fica atrás do gate de JWT como o resto de /api mesmo assim, já que
  // não há motivo pra expor isso a quem não está logado.
  router.get('/vapid-public-key', (_req, res) => {
    const chave = process.env.VAPID_PUBLIC_KEY;
    if (!chave) return res.status(503).json({ success: false, error: 'Push notifications não configuradas neste servidor' });
    res.json({ success: true, data: { publicKey: chave } });
  });

  router.get('/me/subscriptions', async (req: AuthenticatedRequest, res) => {
    try {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select(SELECT_SUBSCRIPTION)
        .eq('usuario_id', req.usuario!.id)
        .order('criado_em', { ascending: false });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao listar subscriptions:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/me/subscriptions', async (req: AuthenticatedRequest, res) => {
    try {
      const { tipo, endpoint, keys, token, user_agent } = req.body || {};
      const userAgent = user_agent ? String(user_agent).slice(0, 200) : null;

      if (tipo === 'web') {
        if (!endpoint || !keys?.p256dh || !keys?.auth) {
          return res.status(400).json({ success: false, error: 'Subscription de Web Push incompleta' });
        }
        const { data, error } = await supabase
          .from('push_subscriptions')
          .upsert(
            { usuario_id: req.usuario!.id, tipo: 'web', endpoint, p256dh: keys.p256dh, auth_key: keys.auth, fcm_token: null, user_agent: userAgent, ativo: true },
            { onConflict: 'endpoint' }
          )
          .select(SELECT_SUBSCRIPTION)
          .single();
        if (error) throw error;
        return res.json({ success: true, data });
      }

      if (tipo === 'fcm') {
        if (!token) return res.status(400).json({ success: false, error: 'Token FCM é obrigatório' });
        const { data, error } = await supabase
          .from('push_subscriptions')
          .upsert(
            { usuario_id: req.usuario!.id, tipo: 'fcm', endpoint: null, p256dh: null, auth_key: null, fcm_token: token, user_agent: userAgent, ativo: true },
            { onConflict: 'fcm_token' }
          )
          .select(SELECT_SUBSCRIPTION)
          .single();
        if (error) throw error;
        return res.json({ success: true, data });
      }

      res.status(400).json({ success: false, error: 'Tipo de subscription inválido' });
    } catch (error: any) {
      console.error('Erro ao registrar subscription:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Confirma que a subscription pertence a quem está pedindo antes de deixar
  // mexer — nunca deixa alterar/apagar a de outro usuário só sabendo o id.
  async function carregarSubscriptionDoUsuario(req: AuthenticatedRequest, res: any) {
    const { data, error } = await supabase.from('push_subscriptions').select('id, usuario_id').eq('id', req.params.id).maybeSingle();
    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return null;
    }
    if (!data || data.usuario_id !== req.usuario!.id) {
      res.status(404).json({ success: false, error: 'Subscription não encontrada' });
      return null;
    }
    return data;
  }

  router.patch('/me/subscriptions/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const sub = await carregarSubscriptionDoUsuario(req, res);
      if (!sub) return;

      const ativo = req.body?.ativo;
      if (typeof ativo !== 'boolean') return res.status(400).json({ success: false, error: '"ativo" precisa ser booleano' });

      const { data, error } = await supabase.from('push_subscriptions').update({ ativo }).eq('id', sub.id).select(SELECT_SUBSCRIPTION).single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao atualizar subscription:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete('/me/subscriptions/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const sub = await carregarSubscriptionDoUsuario(req, res);
      if (!sub) return;

      const { error } = await supabase.from('push_subscriptions').delete().eq('id', sub.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao remover subscription:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
