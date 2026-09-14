import { api } from '../../utils/api';
import type { PushSubscriptionResumo } from './types';

interface ApiResult<T> {
  success: boolean;
  data: T;
  error?: string;
}

export const notificacoesApi = {
  vapidPublicKey: (): Promise<ApiResult<{ publicKey: string }>> => api.get('/api/notificacoes/vapid-public-key'),
  listarSubscriptions: (): Promise<ApiResult<PushSubscriptionResumo[]>> => api.get('/api/notificacoes/me/subscriptions'),
  registrarWeb: (subscription: PushSubscriptionJSON, userAgent: string): Promise<ApiResult<PushSubscriptionResumo>> =>
    api.post('/api/notificacoes/me/subscriptions', { tipo: 'web', endpoint: subscription.endpoint, keys: subscription.keys, user_agent: userAgent }),
  registrarFcm: (token: string, userAgent: string): Promise<ApiResult<PushSubscriptionResumo>> =>
    api.post('/api/notificacoes/me/subscriptions', { tipo: 'fcm', token, user_agent: userAgent }),
  atualizarAtivo: (id: string, ativo: boolean): Promise<ApiResult<PushSubscriptionResumo>> => api.patch(`/api/notificacoes/me/subscriptions/${id}`, { ativo }),
  remover: (id: string): Promise<ApiResult<null>> => api.delete(`/api/notificacoes/me/subscriptions/${id}`),
};
