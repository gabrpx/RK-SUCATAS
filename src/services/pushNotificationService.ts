// Serviço central de envio de push — Web Push (navegador) e FCM (app Android
// nativo, via Firebase Admin SDK). Nenhum gatilho de negócio deve falar com
// `web-push`/`firebase-admin` direto: só chamar notificarUsuario/
// notificarUsuarios, sempre fire-and-forget (.catch), mesmo padrão já usado
// em casarComPecasProcuradas (src/server/routes/estoque.ts) — uma falha de
// push nunca pode derrubar a operação principal (criar tarefa, etc).
import webpush from 'web-push';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
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

let firebaseConfigurado = false;

// FIREBASE_SERVICE_ACCOUNT guarda o JSON inteiro da service account (gerado
// em Project Settings > Service Accounts > Generate new private key) como
// string — mesmo padrão de env var sensível usado pro resto do projeto, sem
// arquivo extra pra gerenciar no deploy.
function garantirFirebaseConfigurado(): boolean {
  if (firebaseConfigurado) return true;
  const { FIREBASE_SERVICE_ACCOUNT } = process.env;
  if (!FIREBASE_SERVICE_ACCOUNT) return false;
  try {
    const credenciais = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    if (!getApps().length) {
      initializeApp({ credential: cert(credenciais) });
    }
    firebaseConfigurado = true;
    return true;
  } catch (err: any) {
    console.error('FIREBASE_SERVICE_ACCOUNT inválido (não é um JSON de service account válido):', err?.message || err);
    return false;
  }
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
      if (!garantirVapidConfigurado()) {
        console.warn('⚠️ Push Web pulado: configure VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT no .env.');
        return;
      }
      if (!sub.endpoint || !sub.p256dh || !sub.auth_key) return;
      const subscription = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } };
      await webpush.sendNotification(subscription, JSON.stringify(payload));
      return;
    }

    // tipo === 'fcm': app Android nativo, via Firebase Cloud Messaging.
    if (!garantirFirebaseConfigurado()) {
      console.warn('⚠️ Push FCM pulado: configure FIREBASE_SERVICE_ACCOUNT no .env.');
      return;
    }
    if (!sub.fcm_token) return;
    await getMessaging().send({
      token: sub.fcm_token,
      notification: { title: payload.titulo, body: payload.corpo },
      data: { url: payload.url || '/' },
    });
  } catch (err: any) {
    const statusCode = err?.statusCode;
    const firebaseCode = err?.code;
    const tokenMorto =
      statusCode === 404 ||
      statusCode === 410 ||
      firebaseCode === 'messaging/registration-token-not-registered' ||
      firebaseCode === 'messaging/invalid-registration-token' ||
      firebaseCode === 'messaging/invalid-argument';
    if (tokenMorto) {
      // Endpoint/token expirado/revogado — limpa pra não tentar de novo pra
      // sempre num destino morto.
      await supabase.from('push_subscriptions').delete().eq('id', sub.id);
    } else {
      console.error(`Erro ao enviar push (subscription ${sub.id}):`, err?.message || err);
    }
  }
}

// Envia pra um usuário em todos os dispositivos ativos dele. Nunca lança —
// cada falha é isolada por subscription, quem chama não precisa tratar erro.
export async function notificarUsuario(supabase: SupabaseClient, usuarioId: string, payload: NotificacaoPayload): Promise<void> {
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
