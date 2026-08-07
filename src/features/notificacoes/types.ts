export interface PushSubscriptionResumo {
  id: string;
  tipo: 'web' | 'fcm';
  user_agent: string | null;
  ativo: boolean;
  criado_em: string;
}
