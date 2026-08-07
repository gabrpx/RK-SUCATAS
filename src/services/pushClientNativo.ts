// Cliente de push nativo (Android via Firebase Cloud Messaging) — equivalente
// a pushClient.ts, mas pro app empacotado com Capacitor em vez do navegador.
// Só deve ser chamado quando Capacitor.isNativePlatform() é true (ver
// NotificacoesView.tsx, que decide qual dos dois fluxos usar). Mesma regra
// do pushClient.ts: nunca pedir permissão sozinho no mount, só a partir de
// um clique explícito do usuário.
import { PushNotifications } from '@capacitor/push-notifications';
import { notificacoesApi } from '../features/notificacoes/api';
import type { AtivarResultado } from './pushClient';

// Resolve com o token FCM assim que o SDK nativo termina de registrar, ou
// rejeita se o registro falhar — PushNotifications.register() não retorna o
// token diretamente, ele chega depois via evento.
function registrarEAguardarToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    PushNotifications.addListener('registration', (token) => {
      PushNotifications.removeAllListeners();
      resolve(token.value);
    });
    PushNotifications.addListener('registrationError', (err) => {
      PushNotifications.removeAllListeners();
      reject(new Error(err.error || 'Erro ao registrar push'));
    });
    PushNotifications.register();
  });
}

export async function ativarPushNativoNesteDispositivo(): Promise<AtivarResultado> {
  try {
    let permissao = await PushNotifications.checkPermissions();
    if (permissao.receive === 'prompt' || permissao.receive === 'prompt-with-rationale') {
      permissao = await PushNotifications.requestPermissions();
    }
    if (permissao.receive !== 'granted') return { success: false, motivo: 'permissao_negada' };

    const token = await registrarEAguardarToken();
    await notificacoesApi.registrarFcm(token, navigator.userAgent);
    return { success: true };
  } catch (err: any) {
    console.error('Erro ao ativar push nativo neste dispositivo:', err);
    return { success: false, motivo: 'erro', erro: err?.message };
  }
}
