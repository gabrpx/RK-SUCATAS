// Cliente de Web Push: registra o service worker e conduz o opt-in do
// usuário. Nunca chama Notification.requestPermission() sozinho no load do
// app — só a partir de um clique explícito (ver NotificacoesView.tsx),
// porque vários navegadores ignoram/bloqueiam o prompt de permissão sem
// gesto do usuário, e pedir permissão sem contexto é anti-padrão de UX.
import { notificacoesApi } from '../features/notificacoes/api';

export function suportaWebPush(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// VAPID exige a chave pública como Uint8Array no subscribe(), mas o backend
// manda ela em base64url (formato padrão de troca) — conversão de praxe do
// protocolo Web Push, não tem lib oficial pra isso.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function registrarServiceWorker(): Promise<ServiceWorkerRegistration> {
  const existente = await navigator.serviceWorker.getRegistration('/sw.js');
  if (existente) return existente;
  return navigator.serviceWorker.register('/sw.js');
}

export type AtivarResultado = { success: true } | { success: false; motivo: 'sem_suporte' | 'permissao_negada' | 'erro'; erro?: string };

// Fluxo completo de opt-in: pede permissão (se ainda não decidida), registra
// o SW, assina no PushManager com a chave pública do backend, e envia a
// subscription pro servidor. Deve ser chamado só a partir de um clique do
// usuário (handler de onClick), nunca em um useEffect de mount.
export async function ativarPushNesteDispositivo(): Promise<AtivarResultado> {
  if (!suportaWebPush()) return { success: false, motivo: 'sem_suporte' };

  try {
    let permissao = Notification.permission;
    if (permissao === 'default') permissao = await Notification.requestPermission();
    if (permissao !== 'granted') return { success: false, motivo: 'permissao_negada' };

    const registration = await registrarServiceWorker();
    const { data } = await notificacoesApi.vapidPublicKey();

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });
    }

    await notificacoesApi.registrarWeb(subscription.toJSON(), navigator.userAgent);
    return { success: true };
  } catch (err: any) {
    console.error('Erro ao ativar push neste dispositivo:', err);
    return { success: false, motivo: 'erro', erro: err?.message };
  }
}
