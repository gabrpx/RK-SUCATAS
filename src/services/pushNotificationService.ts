// Serviço central de envio de push — só Web Push por enquanto (branch 'fcm'
// reservado pra quando o Android ganhar push nativo via Firebase, fora do
// escopo desta entrega). Nenhum gatilho de negócio deve falar com `web-push`
// direto: só chamar notificarUsuario/notificarUsuarios, sempre fire-and-forget
// (.catch), mesmo padrão já usado em casarComPecasProcuradas
// (src/server/routes/estoque.ts) — uma falha de push nunca pode derrubar a
// operação principal (criar tarefa, etc).
import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';

let vapidConfigurado = false;

function garantirVapidConfigurado(): boolean {
  if (vapidConfigurado) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidConfigurado = true;
  return true;
}

export interface NotificacaoPayload {
  titulo: string;
  corpo: string;
  /** Rota da SPA pra abrir/focar ao clicar na notificação, ex: '/tarefas'. */
  url?: string;
}

interface PushSubscriptionRow {
  id: string;
  tipo: 'web' | 'fcm';
  endpoint: string | null;
  p256dh: string | null;
  auth_key: string | null;
  fcm_token: string | null;
}

async function enviarParaUmaSubscription(supabase: SupabaseClient, sub: PushSubscriptionRow, payload: NotificacaoPayload): Promise<void> {
  try {
    if (sub.tipo === 'web') {
      if (!sub.endpoint || !sub.p256dh || !sub.auth_key) return;
      const subscription = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } };
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      return;
    }
    // tipo === 'fcm': sem SDK do Firebase integrado ainda (Fase 2), nada a
    // fazer — a subscription já fica salva pra quando isso for ligado.
  } catch (err: any) {
    const statusCode = err?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      // Endpoint expirado/revogado pelo navegador — limpa pra não tentar de
      // novo pra sempre num destino morto.
      await supabase.from('push_subscriptions').delete().eq('id', sub.id);
    } else {
      console.error(`Erro ao enviar push (subscription ${sub.id}):`, err?.message || err);
    }
  }
}

// Envia pra um usuário em todos os dispositivos ativos dele. Nunca lança —
// cada falha é isolada por subscription, quem chama não precisa tratar erro.
export async function notificarUsuario(supabase: SupabaseClient, usuarioId: string, payload: NotificacaoPayload): Promise<void> {
  if (!garantirVapidConfigurado()) {
    console.warn('⚠️ Push notification pulado: configure VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT no .env.');
    return;
  }

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, tipo, endpoint, p256dh, auth_key, fcm_token')
    .eq('usuario_id', usuarioId)
    .eq('ativo', true);
  if (error) {
    console.error('Erro ao buscar push_subscriptions:', error.message);
    return;
  }
  if (!subs || subs.length === 0) return;

  await Promise.all((subs as PushSubscriptionRow[]).map((sub) => enviarParaUmaSubscription(supabase, sub, payload)));
}

// Mesmo que notificarUsuario, mas pra vários usuários de uma vez — usado pelo
// aviso agregado diário (fiado/clientes sumidos) pra todos os admins/equipe.
export async function notificarUsuarios(supabase: SupabaseClient, usuarioIds: string[], payload: NotificacaoPayload): Promise<void> {
  const idsUnicos = Array.from(new Set(usuarioIds));
  await Promise.all(idsUnicos.map((id) => notificarUsuario(supabase, id, payload)));
}
